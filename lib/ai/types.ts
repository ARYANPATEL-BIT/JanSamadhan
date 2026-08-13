/**
 * AI provider abstraction layer.
 *
 * All vision-AI communication goes through VisionAIProvider. The concrete
 * implementation (Gemini, OpenAI, etc.) is selected at startup — nothing
 * downstream knows or cares which provider is active.
 *
 * Rule: AI output is UNTRUSTED. Every field must be validated by the caller.
 */

import type { Category } from "@/lib/pipeline/types";

// ---------------------------------------------------------------------------
// Civic image analysis
// ---------------------------------------------------------------------------

export interface CivicImageInput {
  /** Raw image bytes. */
  imageBytes: Uint8Array;
  /** MIME type (validated server-side). */
  contentType: string;
  /** Optional: user-claimed category, for spam cross-check. */
  claimedCategory?: Category;
}

/**
 * Structured result from analyzing a single civic-issue image.
 * The AI must return exactly this shape — free-text is rejected.
 */
export interface CivicImageAnalysis {
  /** Whether the image appears to depict a civic issue. */
  is_civic_issue: boolean;
  /** One of the supported civic categories. */
  category: Category;
  /** Model confidence 0–1. */
  confidence: number;
  /** Whether the image looks like spam / irrelevant content. */
  spam_suspected: boolean;
  /** Short internal/debugging explanation. */
  reason: string;
  /** Bounding box [x, y, w, h] in normalized 0–1 coords, if available. */
  bbox: [number, number, number, number] | null;
  /** Whether there are multiple plausible categories. */
  multiple_categories: boolean;
  /** Alternative category suggestions (max 3), if any. */
  alternative_categories: Category[];
}

// ---------------------------------------------------------------------------
// Image comparison (duplicate + before/after)
// ---------------------------------------------------------------------------

export type ComparisonMode = "duplicate" | "resolution";

export interface ImageComparisonInput {
  /** First image bytes (e.g. the existing/before image). */
  image1Bytes: Uint8Array;
  image1ContentType: string;
  /** Second image bytes (e.g. the new/after image). */
  image2Bytes: Uint8Array;
  image2ContentType: string;
  /** What kind of comparison to perform. */
  mode: ComparisonMode;
}

/** Result for duplicate-check comparisons. */
export interface DuplicateComparisonResult {
  mode: "duplicate";
  same_physical_issue: boolean;
  confidence: number;
  reason: string;
}

/** Result for before/after resolution comparisons. */
export interface ResolutionComparisonResult {
  mode: "resolution";
  same_scene: boolean;
  issue_addressed: boolean;
  confidence: number;
  reason: string;
}

export type ImageComparisonResult =
  | DuplicateComparisonResult
  | ResolutionComparisonResult;

// ---------------------------------------------------------------------------
// Provider interface
// ---------------------------------------------------------------------------

/**
 * Abstract vision-AI provider. Implementations wrap a specific API
 * (Gemini, OpenAI Vision, etc.) and return validated, structured data.
 */
export interface VisionAIProvider {
  readonly providerName: string;
  readonly modelName: string;

  /**
   * Analyze a single image for civic-issue classification + spam detection.
   * Must return a validated CivicImageAnalysis or throw.
   */
  analyzeCivicImage(input: CivicImageInput): Promise<CivicImageAnalysis>;

  /**
   * Compare two images (duplicate check or before/after resolution check).
   * Must return a validated ImageComparisonResult or throw.
   */
  compareImages(input: ImageComparisonInput): Promise<ImageComparisonResult>;
}

// ---------------------------------------------------------------------------
// Failure type — callers can handle AI failure gracefully
// ---------------------------------------------------------------------------

export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "TIMEOUT"
      | "RATE_LIMIT"
      | "INVALID_RESPONSE"
      | "API_ERROR"
      | "MISSING_KEY"
      | "NETWORK_ERROR",
    public readonly provider: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}
