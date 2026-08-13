/**
 * Pre-upload image validation.
 *
 * Runs BEFORE any AI call or Cloudinary upload. Validates MIME type,
 * file size, magic bytes, and generates safe internal references.
 * Does NOT trust client-provided MIME alone — inspects file headers.
 */

import { AI_CONFIG } from "./config";

const ALLOWED_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

/**
 * Magic byte signatures for image formats.
 * We inspect the first few bytes to validate file type independently
 * of the client-provided Content-Type header.
 */
const MAGIC_BYTES: { mime: string; bytes: number[] }[] = [
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] }, // "RIFF" prefix
];

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
  detectedMime?: string;
  safeExtension?: string;
}

/**
 * Validate an uploaded image file before processing.
 *
 * @param bytes     Raw file bytes
 * @param claimedMime  Client-provided MIME type (not trusted)
 * @param fileName  Client-provided filename (not trusted)
 */
export function validateImage(
  bytes: Uint8Array,
  claimedMime: string,
  fileName?: string,
): ImageValidationResult {
  // 1. File size check
  if (bytes.length === 0) {
    return { valid: false, error: "Empty file" };
  }
  if (bytes.length > AI_CONFIG.maxImageSizeBytes) {
    const maxMB = (AI_CONFIG.maxImageSizeBytes / (1024 * 1024)).toFixed(0);
    return { valid: false, error: `File too large (max ${maxMB} MB)` };
  }

  // 2. Magic byte detection — don't trust claimedMime
  const detectedMime = detectMimeFromMagicBytes(bytes);
  if (!detectedMime) {
    return { valid: false, error: "Unsupported image format" };
  }
  if (!ALLOWED_MIMES.has(detectedMime)) {
    return { valid: false, error: `Image type ${detectedMime} is not supported` };
  }

  // 3. Extension check (if filename provided)
  if (fileName) {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
      return { valid: false, error: `File extension .${ext} is not allowed` };
    }
    // Path traversal prevention
    if (fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
      return { valid: false, error: "Invalid filename" };
    }
  }

  // 4. Cross-check client MIME vs detected MIME (warn but don't reject)
  const normalizedClaimed = claimedMime.toLowerCase().trim();
  if (ALLOWED_MIMES.has(normalizedClaimed) && normalizedClaimed !== detectedMime) {
    // MIME mismatch — proceed with detected MIME (server truth)
    // This is common: browsers sometimes send image/jpeg for webp, etc.
  }

  const safeExtension = mimeToExtension(detectedMime);
  return { valid: true, detectedMime, safeExtension };
}

function detectMimeFromMagicBytes(bytes: Uint8Array): string | null {
  for (const sig of MAGIC_BYTES) {
    if (sig.bytes.every((b, i) => bytes[i] === b)) {
      // For WEBP, verify the WEBP marker at offset 8
      if (sig.mime === "image/webp") {
        if (
          bytes.length >= 12 &&
          bytes[8] === 0x57 && // 'W'
          bytes[9] === 0x45 && // 'E'
          bytes[10] === 0x42 && // 'B'
          bytes[11] === 0x50 // 'P'
        ) {
          return sig.mime;
        }
        continue; // RIFF header but not WEBP
      }
      return sig.mime;
    }
  }
  return null;
}

function mimeToExtension(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}
