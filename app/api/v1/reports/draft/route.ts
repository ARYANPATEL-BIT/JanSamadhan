import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getCurrentUser } from "@/lib/auth/session";
import { getPipelineClient } from "@/lib/pipeline/client";
import { resolveWard, resolveDepartment } from "@/lib/geo/ward-lookup";
import { putObject } from "@/lib/storage/s3";
import { signDraftTicket, type DraftTicket } from "@/lib/reports/draft-ticket";
import { validateImage } from "@/lib/ai/image-validation";
import { confidenceDecision } from "@/lib/ai/config";

export const runtime = "nodejs";

function num(v: FormDataEntryValue | null): number | null {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "image_required" }, { status: 400 });
  }

  const lng = num(form.get("lng"));
  const lat = num(form.get("lat"));
  if (lng === null || lat === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "invalid_location" }, { status: 400 });
  }

  const gpsAccuracyM = num(form.get("accuracy"));
  const capturedAt = num(form.get("capturedAt")) ?? Date.now();
  const capturePath = form.get("capturePath") === "GALLERY" ? "GALLERY" : "IN_APP";

  const bytes = new Uint8Array(await file.arrayBuffer());
  const claimedContentType = file.type || "image/jpeg";

  // --- Image validation (MIME, size, magic bytes) ---
  const validation = validateImage(bytes, claimedContentType, file.name);
  if (!validation.valid) {
    return NextResponse.json(
      { error: "invalid_image", detail: validation.error },
      { status: 400 },
    );
  }
  const contentType = validation.detectedMime ?? claimedContentType;

  // Layer-3 exact-file signal: SHA-256 of raw bytes, computed for real even in
  // sprint 1 (pure Node crypto, no ML).
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const receivedAt = Date.now();

  const ext = validation.safeExtension ?? (contentType.includes("png") ? "png" : "jpg");
  const objectKey = `reports/${sha256}.${ext}`;
  const url = await putObject(objectKey, bytes, contentType);

  // The ML seam. Stub in sprint 1; Gemini in sprint 2; real FastAPI in sprint 3.
  let verdict;
  let aiAnalysisStatus: "completed" | "failed" | "skipped" = "skipped";
  try {
    verdict = await getPipelineClient().analyze({
      sha256,
      bytes,
      contentType,
      location: { lng, lat },
      gpsAccuracyM,
      capturedAt,
      receivedAt,
      capturePath,
    });
    aiAnalysisStatus = verdict.engine === "stub" ? "skipped" : "completed";
  } catch (err) {
    // AI failure — degrade gracefully to manual mode
    console.error("[draft] Pipeline failed, degrading to manual:", err);
    aiAnalysisStatus = "failed";
    // Use a fallback verdict so the report can still be submitted
    const { StubPipelineClient } = require("@/lib/pipeline/stub") as typeof import("@/lib/pipeline/stub");
    verdict = await new StubPipelineClient().analyze({
      sha256,
      bytes,
      contentType,
      location: { lng, lat },
      gpsAccuracyM,
      capturedAt,
      receivedAt,
      capturePath,
    });
    // Override stub defaults to signal failure
    verdict.layer1.confidence = 0;
    verdict.layer1.category = "other";
    verdict.layer1.decision = "WARN";
    verdict.combined = "MANUAL_REVIEW";
  }

  const ward = await resolveWard(lng, lat);
  const dept = ward
    ? await resolveDepartment(ward.municipalityId, verdict.layer1.category)
    : null;

  const ticket: DraftTicket = {
    objectKey,
    url,
    sha256,
    contentType,
    lng,
    lat,
    gpsAccuracyM,
    capturedAt,
    receivedAt,
    capturePath,
    captureTrust: verdict.layer3.captureTrust,
    wardId: ward?.wardId ?? null,
    municipalityId: ward?.municipalityId ?? null,
    suggestedCategory: verdict.layer1.category,
    categoryConfidence: verdict.layer1.confidence,
    combined: verdict.combined,
    spamSuspected: verdict.layer1.nsfw || (verdict.combined === "MANUAL_REVIEW" && verdict.layer1.confidence < 0.3),
    aiAnalysisStatus,
  };
  const token = await signDraftTicket(ticket);

  // Compute confidence decision for the frontend
  const confDecision = confidenceDecision(verdict.layer1.confidence);

  return NextResponse.json({
    ticket: token,
    verdict: {
      combined: verdict.combined,
      captureTrust: verdict.layer3.captureTrust,
      nsfw: verdict.layer1.nsfw,
      candidates: verdict.layer2.candidates,
    },
    suggestion: {
      category: verdict.layer1.category,
      confidence: verdict.layer1.confidence,
      confidenceDecision: confDecision,
      ward: ward ? { wardNo: ward.wardNo, municipalityName: ward.municipalityName } : null,
      hasDepartment: !!dept,
      imageUrl: url,
    },
    ai: {
      status: aiAnalysisStatus,
      spamSuspected: ticket.spamSuspected,
      isCivicIssue: verdict.layer1.confidence > 0,
      engine: verdict.engine,
    },
  });
}
