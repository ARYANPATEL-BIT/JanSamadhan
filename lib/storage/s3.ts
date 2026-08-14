import { v2 as cloudinary } from "cloudinary";

// Configure from env — expects CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Upload bytes to Cloudinary. Returns the public HTTPS URL directly
 * (no media proxy needed — Cloudinary serves images via CDN).
 */
export async function putObject(
  key: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<string> {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    throw new Error("Cloudinary is not configured");
  }
  // Convert bytes to base64 data URI for Cloudinary upload
  const mime = contentType || "image/jpeg";
  const b64 = Buffer.from(bytes).toString("base64");
  const dataUri = `data:${mime};base64,${b64}`;

  // Use the SHA-based key as the public_id (strip extension)
  const publicId = key.replace(/\.[^.]+$/, "");

  const result = await cloudinary.uploader.upload(dataUri, {
    public_id: publicId,
    folder: "civic-media",
    resource_type: "image",
    overwrite: true,
  });

  // Return the full Cloudinary CDN URL — no proxy needed
  return result.secure_url;
}

/**
 * Get an object from Cloudinary. Used by the media proxy route as a fallback,
 * but with Cloudinary the URLs are direct CDN links so this is rarely called.
 */
export async function getObject(
  key: string,
): Promise<{ stream: ReadableStream; contentType: string } | null> {
  try {
    // Build the Cloudinary URL for this key
    const publicId = `civic-media/${key.replace(/\.[^.]+$/, "")}`;
    const url = cloudinary.url(publicId, {
      secure: true,
      resource_type: "image",
    });

    const res = await fetch(url);
    if (!res.ok || !res.body) return null;

    return {
      stream: res.body,
      contentType: res.headers.get("content-type") ?? "image/jpeg",
    };
  } catch {
    return null;
  }
}
