/**
 * AI configuration — all thresholds and tunables in one place.
 * Read from environment variables with sensible defaults.
 * No magic numbers scattered throughout the codebase.
 */

export const AI_CONFIG = {
  /** Confidence ≥ this → auto-accept the AI category. */
  confidenceHigh: num("AI_CONFIDENCE_HIGH", 0.75),
  /** Confidence ≥ this (but below high) → suggest with user confirmation. */
  confidenceMedium: num("AI_CONFIDENCE_MEDIUM", 0.50),
  /** Below medium → manual category selection. */

  /** Gemini API call timeout in milliseconds. */
  analysisTimeoutMs: num("AI_ANALYSIS_TIMEOUT_MS", 30000),
  /** Max Gemini API calls per minute (backend rate limit). */
  rateLimitPerMin: num("AI_RATE_LIMIT_PER_MIN", 30),

  /** pHash Hamming distance ≤ this → near-certain duplicate. */
  phashNear: num("AI_PHASH_NEAR", 6),
  /** pHash Hamming distance ≤ this → likely duplicate. */
  phashLikely: num("AI_PHASH_LIKELY", 12),

  /** GPS proximity radius for point issues (meters). */
  duplicateRadiusPointM: num("AI_DUPLICATE_RADIUS_M", 30),
  /** GPS proximity radius for linear issues (meters). */
  duplicateRadiusLinearM: num("AI_DUPLICATE_RADIUS_LINEAR_M", 60),

  /** Max age of reports to check for duplicates (days). */
  duplicateMaxAgeDays: num("AI_DUPLICATE_MAX_AGE_DAYS", 90),

  /** Max image file size in bytes (10 MB). */
  maxImageSizeBytes: num("AI_MAX_IMAGE_SIZE_BYTES", 10 * 1024 * 1024),
} as const;

/**
 * Read a numeric env var or return the default.
 * Evaluated lazily at first access (process.env isn't available at module parse
 * time in some Next.js contexts).
 */
function num(envKey: string, fallback: number): number {
  const v = process.env[envKey];
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Decision based on confidence level. */
export type ConfidenceDecision = "AUTO_ACCEPT" | "SUGGEST" | "MANUAL";

export function confidenceDecision(confidence: number): ConfidenceDecision {
  if (confidence >= AI_CONFIG.confidenceHigh) return "AUTO_ACCEPT";
  if (confidence >= AI_CONFIG.confidenceMedium) return "SUGGEST";
  return "MANUAL";
}
