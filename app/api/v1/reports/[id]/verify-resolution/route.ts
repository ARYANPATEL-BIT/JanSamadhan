import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getCurrentUser } from "@/lib/auth/session";
import { putObject } from "@/lib/storage/s3";
import { validateImage } from "@/lib/ai/image-validation";
import { verifyResolution } from "@/lib/ai/resolution-verification";
import { db } from "@/lib/db/client";
import { reportMedia } from "@/lib/db/schema";

export const runtime = "nodejs";

/**
 * POST /api/v1/reports/:id/verify-resolution
 *
 * Upload an "after" image for before/after resolution verification.
 * Runs Gemini comparison but does NOT auto-resolve the report.
 * Result is stored for admin/citizen review.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: reportId } = await params;

  const form = await req.formData();
  const file = form.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "image_required" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const claimedMime = file.type || "image/jpeg";

  // Validate image
  const validation = validateImage(bytes, claimedMime, file.name);
  if (!validation.valid) {
    return NextResponse.json(
      { error: "invalid_image", detail: validation.error },
      { status: 400 },
    );
  }

  const contentType = validation.detectedMime ?? claimedMime;
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const ext = validation.safeExtension ?? "jpg";
  const objectKey = `after/${sha256}.${ext}`;

  // Upload to storage
  const url = await putObject(objectKey, bytes, contentType);

  // Store the AFTER media record
  await db.insert(reportMedia).values({
    reportId,
    kind: "AFTER",
    url,
    sha256,
    capturePath: "IN_APP",
    capturedAt: new Date(),
    exifPresent: false,
  });

  // Run AI comparison (before vs after)
  const result = await verifyResolution({
    reportId,
    afterImageBytes: bytes,
    afterImageContentType: contentType,
    afterImageUrl: url,
    afterImageSha256: sha256,
  });

  return NextResponse.json({
    ok: true,
    afterImageUrl: url,
    verification: result.comparison,
    aiAvailable: result.aiAvailable,
    message: result.aiAvailable
      ? result.comparison?.issue_addressed
        ? "AI analysis suggests the issue has been addressed. Awaiting human confirmation."
        : "AI analysis suggests the issue may not be fully addressed. Manual review required."
      : "AI analysis unavailable. Manual review required.",
    error: result.error,
  });
}
