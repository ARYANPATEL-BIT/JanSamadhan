/**
 * GeminiPipelineClient — plugs into the existing PipelineClient seam.
 *
 * Replaces the stub with real Gemini-powered image analysis while
 * maintaining the exact same PipelineVerdict shape. Everything
 * downstream (draft ticket, report creation, UI) remains unchanged.
 *
 * Graceful degradation: if Gemini fails for any reason, the pipeline
 * returns a MANUAL_REVIEW verdict with category "other" and confidence 0.
 * The user is shown a manual category picker instead of a crash.
 */

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { aiAnalyses } from "@/lib/db/schema";
import type { PipelineClient } from "./client";
import {
  PIPELINE_THRESHOLDS,
  type PipelineInput,
  type PipelineVerdict,
  type Category,
} from "./types";
import { getVisionProvider } from "@/lib/ai/provider";
import { computePhash } from "@/lib/ai/phash";
import { checkDuplicates } from "@/lib/ai/duplicate-detection";
import { confidenceDecision } from "@/lib/ai/config";
import { AIProviderError } from "@/lib/ai/types";
import type { CivicImageAnalysis } from "@/lib/ai/types";

export class GeminiPipelineClient implements PipelineClient {
  async analyze(input: PipelineInput): Promise<PipelineVerdict> {
    // ------------------------------------------------------------------
    // Layer 1 — AI image analysis (with cache + graceful degradation)
    // ------------------------------------------------------------------
    let layer1Analysis: CivicImageAnalysis | null = null;
    let aiStatus: "completed" | "failed" | "skipped" = "skipped";
    let aiError: string | undefined;

    // Check cache first — don't re-analyze the same image
    const cached = await getCachedAnalysis(input.sha256);
    if (cached) {
      layer1Analysis = cached;
      aiStatus = "completed";
    } else {
      // Try Gemini analysis
      const provider = getVisionProvider();
      if (provider && input.bytes) {
        try {
          layer1Analysis = await provider.analyzeCivicImage({
            imageBytes: input.bytes,
            contentType: input.contentType,
          });
          aiStatus = "completed";

          // Cache the result for future lookups
          await cacheAnalysis(input.sha256, layer1Analysis, provider.providerName, provider.modelName);
        } catch (err) {
          aiStatus = "failed";
          aiError = err instanceof AIProviderError ? err.code : "UNKNOWN";
          console.error("[GeminiPipeline] Layer 1 failed, degrading to manual:", err);
        }
      }
    }

    // Build Layer 1 result
    const l1Category: Category = layer1Analysis?.category ?? "other";
    const l1Confidence = layer1Analysis?.confidence ?? 0;
    const l1Decision = aiStatus === "completed"
      ? mapConfidenceDecision(confidenceDecision(l1Confidence))
      : "MANUAL_REVIEW";

    const layer1 = {
      category: l1Category,
      confidence: l1Confidence,
      bbox: layer1Analysis?.bbox ?? null,
      nsfw: false, // Gemini doesn't produce explicit NSFW flags; spam_suspected covers this
      decision: l1Decision,
    };

    // ------------------------------------------------------------------
    // Layer 2 — Duplicate detection (pHash + GPS + category)
    // ------------------------------------------------------------------
    let phash: string | null = null;

    // Compute pHash for this image
    if (input.bytes) {
      try {
        phash = await computePhash(input.bytes);
      } catch (err) {
        console.error("[GeminiPipeline] pHash computation failed:", err);
      }
    }

    // Run duplicate checks
    let duplicateResult;
    try {
      duplicateResult = await checkDuplicates({
        sha256: input.sha256,
        phash,
        lng: input.location.lng,
        lat: input.location.lat,
        category: l1Category,
        imageBytes: input.bytes,
        contentType: input.contentType,
      });
    } catch (err) {
      console.error("[GeminiPipeline] Duplicate detection failed:", err);
      duplicateResult = { candidates: [], exactMatch: false };
    }

    const layer2 = {
      phash,
      candidates: duplicateResult.candidates,
    };

    // ------------------------------------------------------------------
    // Layer 3 — Capture attestation (same logic as stub)
    // ------------------------------------------------------------------
    const galleryLowTrust = input.capturePath === "GALLERY";
    const clockSkewMs = Math.abs(input.receivedAt - input.capturedAt);
    const clockSkewTrust = clockSkewMs < 30_000 ? 1 : clockSkewMs < 300_000 ? 0.7 : 0.4;
    const gpsTrust = input.gpsAccuracyM != null && input.gpsAccuracyM < 50 ? 1 : 0.6;
    const captureTrust = galleryLowTrust
      ? 0.5
      : Math.min(clockSkewTrust, gpsTrust) * 0.95;

    const layer3 = {
      captureTrust,
      path: input.capturePath,
      lowTrust: galleryLowTrust,
      exifPresent: false,
      collusion: false,
    };

    // ------------------------------------------------------------------
    // Combined verdict
    // ------------------------------------------------------------------
    let combined: PipelineVerdict["combined"];

    if (layer1Analysis?.spam_suspected || (layer1Analysis && !layer1Analysis.is_civic_issue)) {
      // Spam/irrelevant → manual review (flag, don't block)
      combined = "MANUAL_REVIEW";
    } else if (duplicateResult.candidates.length > 0) {
      combined = "DUPLICATE_CANDIDATES";
    } else if (galleryLowTrust || l1Decision === "MANUAL_REVIEW" || aiStatus === "failed") {
      combined = "MANUAL_REVIEW";
    } else if (l1Decision === "AUTO_ACCEPT" && captureTrust >= 0.75) {
      combined = "CLEAN_HIGH_TRUST";
    } else {
      combined = "MANUAL_REVIEW";
    }

    return {
      combined,
      layer1,
      layer2,
      layer3,
      thresholds: PIPELINE_THRESHOLDS,
      engine: "gemini" as PipelineVerdict["engine"],
    };
  }
}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

async function getCachedAnalysis(sha256: string): Promise<CivicImageAnalysis | null> {
  try {
    const [row] = await db
      .select()
      .from(aiAnalyses)
      .where(eq(aiAnalyses.imageSha256, sha256))
      .limit(1);

    if (!row || row.status !== "completed" || !row.category) return null;

    return {
      is_civic_issue: row.isCivicIssue ?? false,
      category: row.category as Category,
      confidence: row.confidence ?? 0,
      spam_suspected: row.spamSuspected ?? false,
      reason: row.reason ?? "",
      bbox: row.bbox ? JSON.parse(row.bbox) : null,
      multiple_categories: false,
      alternative_categories: [],
    };
  } catch {
    return null;
  }
}

async function cacheAnalysis(
  sha256: string,
  analysis: CivicImageAnalysis,
  provider: string,
  model: string,
): Promise<void> {
  try {
    await db.insert(aiAnalyses).values({
      imageSha256: sha256,
      provider,
      model,
      isCivicIssue: analysis.is_civic_issue,
      category: analysis.category,
      confidence: analysis.confidence,
      spamSuspected: analysis.spam_suspected,
      reason: analysis.reason.slice(0, 500),
      bbox: analysis.bbox ? JSON.stringify(analysis.bbox) : null,
      status: "completed",
    });
  } catch (err) {
    // Non-fatal: cache miss is OK, just means an extra API call next time
    console.error("[GeminiPipeline] Failed to cache analysis:", err);
  }
}

function mapConfidenceDecision(
  d: "AUTO_ACCEPT" | "SUGGEST" | "MANUAL",
): "AUTO_ACCEPT" | "MANUAL_REVIEW" | "WARN" {
  switch (d) {
    case "AUTO_ACCEPT":
      return "AUTO_ACCEPT";
    case "SUGGEST":
      return "MANUAL_REVIEW";
    case "MANUAL":
      return "WARN";
  }
}
