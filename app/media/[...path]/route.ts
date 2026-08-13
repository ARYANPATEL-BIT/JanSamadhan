import { getObject } from "@/lib/storage/s3";

export const runtime = "nodejs";

/**
 * Same-origin media proxy. Streams objects out of MinIO so uploaded photos load
 * from the app's own origin (`/media/reports/<sha>.jpg`) — which means they work
 * unchanged over localhost, a LAN IP, or a Cloudflare tunnel, and MinIO is never
 * exposed to the internet. Content is immutable (keyed by SHA-256), so cache hard.
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
