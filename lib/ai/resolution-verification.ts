/**
 * Before/after resolution verification using Gemini.
 *
 * Workflow:
 *   1. Department uploads AFTER image
 *   2. System retrieves the BEFORE (original report) image
 *   3. Gemini compares them: same scene? issue addressed?
 *   4. Result is STORED and FLAGGED — NOT auto-resolved
 *   5. Admin/citizen confirms or reopens
 *
 * AI is advisory. It cannot automatically mark a report as resolved.
 */

import { sql, eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { reportMedia, reports, aiComparisonResults } from "@/lib/db/schema";
import { getVisionProvider } from "./provider";
import { AIProviderError } from "./types";

export interface VerifyResolutionInput {
  reportId: string;
  afterImageBytes: Uint8Array;
  afterImageContentType: string;
  afterImageUrl: string;
  afterImageSha256: string;
}

export interface VerifyResolutionResult {
  success: boolean;
  /** AI comparison result, if available. */
  comparison: {
    same_scene: boolean;
    issue_addressed: boolean;
    confidence: number;
    reason: string;
  } | null;
  /** Whether AI analysis was available. */
  aiAvailable: boolean;
  /** Error message if AI failed. */
  error?: string;
}

/**
 * Run before/after resolution verification.
 *
 * Returns the AI comparison result (advisory only).
 * Does NOT change report status.
 */
export async function verifyResolution(
  input: VerifyResolutionInput,
): Promise<VerifyResolutionResult> {
  // 1. Get the original REPORT image
  const [beforeMedia] = await db
    .select({ url: reportMedia.url, sha256: reportMedia.sha256 })
    .from(reportMedia)
    .where(
      and(
        eq(reportMedia.reportId, input.reportId),
        eq(reportMedia.kind, "REPORT"),
      ),
    )
    .orderBy(reportMedia.id)
    .limit(1);

  if (!beforeMedia) {
    return {
      success: false,
      comparison: null,
      aiAvailable: false,
      error: "No original report image found",
    };
  }

  // 2. Fetch the before image bytes from its URL
  let beforeBytes: Uint8Array;
  try {
    const res = await fetch(beforeMedia.url);
    if (!res.ok) throw new Error(`Failed to fetch before image: ${res.status}`);
    beforeBytes = new Uint8Array(await res.arrayBuffer());
  } catch (err) {
    return {
      success: false,
      comparison: null,
      aiAvailable: false,
      error: `Could not retrieve original image: ${(err as Error).message}`,
    };
  }

  // 3. Get AI provider
  const provider = getVisionProvider();
  if (!provider) {
    // AI unavailable — store the after image but skip comparison
    return {
      success: true,
      comparison: null,
      aiAvailable: false,
      error: "AI analysis unavailable — manual review required",
    };
  }

  // 4. Run Gemini comparison
  try {
    const result = await provider.compareImages({
      image1Bytes: beforeBytes,
      image1ContentType: "image/jpeg", // before image
      image2Bytes: input.afterImageBytes,
      image2ContentType: input.afterImageContentType,
      mode: "resolution",
    });

    if (result.mode !== "resolution") {
      throw new Error("Unexpected comparison mode");
    }

    // 5. Store the comparison result for auditability
    await db.insert(aiComparisonResults).values({
      reportId: input.reportId,
      comparisonType: "resolution",
      image1Sha256: beforeMedia.sha256 ?? "unknown",
      image2Sha256: input.afterImageSha256,
      sameScene: result.same_scene,
      issueAddressed: result.issue_addressed,
      confidence: result.confidence,
      reason: result.reason,
      provider: provider.providerName,
      model: provider.modelName,
    });

    return {
      success: true,
      comparison: {
        same_scene: result.same_scene,
        issue_addressed: result.issue_addressed,
        confidence: result.confidence,
        reason: result.reason,
      },
      aiAvailable: true,
    };
  } catch (err) {
    const errMsg =
      err instanceof AIProviderError
        ? err.message
        : (err as Error).message;

    return {
      success: true,
      comparison: null,
      aiAvailable: false,
      error: `AI comparison failed: ${errMsg}. Manual review required.`,
    };
  }
}
