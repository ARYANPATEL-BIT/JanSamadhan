import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getVisionProvider } from "@/lib/ai/provider";
import { db } from "@/lib/db/client";
import { reportMedia, aiComparisonResults } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * POST /api/v1/reports/:id/compare
 *
 * Compare the report's image against another report's image for duplicate detection.
 * Body: { targetReportId: string }
 *
 * Admin/review use. Calls Gemini to do visual comparison.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: reportId } = await params;

  const body = await req.json().catch(() => null);
  if (!body?.targetReportId || typeof body.targetReportId !== "string") {
    return NextResponse.json({ error: "targetReportId required" }, { status: 400 });
  }

  const targetReportId = body.targetReportId;

  // Get both report images
  const [image1] = await db
    .select({ url: reportMedia.url, sha256: reportMedia.sha256 })
    .from(reportMedia)
    .where(and(eq(reportMedia.reportId, reportId), eq(reportMedia.kind, "REPORT")))
    .limit(1);

  const [image2] = await db
    .select({ url: reportMedia.url, sha256: reportMedia.sha256 })
    .from(reportMedia)
    .where(and(eq(reportMedia.reportId, targetReportId), eq(reportMedia.kind, "REPORT")))
    .limit(1);

  if (!image1 || !image2) {
    return NextResponse.json({ error: "image_not_found" }, { status: 404 });
  }

  // Fetch image bytes
  let bytes1: Uint8Array;
  let bytes2: Uint8Array;
  try {
    const [res1, res2] = await Promise.all([fetch(image1.url), fetch(image2.url)]);
    if (!res1.ok || !res2.ok) throw new Error("Failed to fetch images");
    bytes1 = new Uint8Array(await res1.arrayBuffer());
    bytes2 = new Uint8Array(await res2.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "failed_to_fetch_images" }, { status: 500 });
  }

  const provider = getVisionProvider();
  if (!provider) {
    return NextResponse.json({
      ok: true,
      comparison: null,
      aiAvailable: false,
      message: "AI analysis unavailable. Manual comparison required.",
    });
  }

  try {
    const result = await provider.compareImages({
      image1Bytes: bytes1,
      image1ContentType: "image/jpeg",
      image2Bytes: bytes2,
      image2ContentType: "image/jpeg",
      mode: "duplicate",
    });

    if (result.mode !== "duplicate") {
      throw new Error("Unexpected comparison mode");
    }

    // Store result for audit
    await db.insert(aiComparisonResults).values({
      reportId,
      comparisonType: "duplicate",
      image1Sha256: image1.sha256 ?? "unknown",
      image2Sha256: image2.sha256 ?? "unknown",
      samePhysicalIssue: result.same_physical_issue,
      confidence: result.confidence,
      reason: result.reason,
      provider: provider.providerName,
      model: provider.modelName,
    });

    return NextResponse.json({
      ok: true,
      comparison: {
        same_physical_issue: result.same_physical_issue,
        confidence: result.confidence,
        reason: result.reason,
      },
      aiAvailable: true,
    });
  } catch (err) {
    return NextResponse.json({
      ok: true,
      comparison: null,
      aiAvailable: false,
      message: `AI comparison failed: ${(err as Error).message}. Manual review required.`,
    });
  }
}
