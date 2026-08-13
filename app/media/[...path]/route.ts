import { getObject } from "@/lib/storage/s3";

export const runtime = "nodejs";

/**
 * Same-origin media proxy fallback. Cloudinary uploads now return a direct CDN
 * `secure_url`, so this route is rarely hit — it remains as a same-origin
 * fallback that streams an object by key (`/media/reports/<sha>.jpg`). Content
 * is immutable (keyed by SHA-256), so cache hard.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const key = path.join("/");
  const obj = await getObject(key);
  if (!obj) return new Response("Not found", { status: 404 });

  return new Response(obj.stream, {
    headers: {
      "Content-Type": obj.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
