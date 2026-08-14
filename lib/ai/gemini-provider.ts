/**
 * Gemini 2.5 Flash — VisionAIProvider implementation.
 *
 * All Gemini API communication is centralized here. No other file
 * should import @google/genai directly.
 *
 * Uses structured JSON output via Gemini's responseSchema to guarantee
 * the response shape. The backend validates every field regardless.
 */

import { GoogleGenAI, Type } from "@google/genai";
import type {
  VisionAIProvider,
  CivicImageInput,
  CivicImageAnalysis,
  ImageComparisonInput,
  ImageComparisonResult,
  DuplicateComparisonResult,
  ResolutionComparisonResult,
} from "./types";
import { AIProviderError } from "./types";
import { AI_CONFIG } from "./config";

const VALID_CATEGORIES = new Set([
  "pothole",
  "garbage_dump",
  "streetlight_out",
  "waterlogging",
  "broken_footpath",
  "open_drain",
  "illegal_dumping",
  "damaged_signage",
  "fallen_tree",
  "stray_animal",
  "other",
]);

const MODEL_NAME = "gemini-3.5-flash";

// ---------------------------------------------------------------------------
// Rate limiter — simple sliding-window counter
// ---------------------------------------------------------------------------
const rateLimiter = {
  calls: [] as number[],
  check() {
    const now = Date.now();
    this.calls = this.calls.filter((t) => now - t < 60_000);
    if (this.calls.length >= AI_CONFIG.rateLimitPerMin) {
      throw new AIProviderError(
        `Rate limit exceeded (${AI_CONFIG.rateLimitPerMin}/min)`,
        "RATE_LIMIT",
        "gemini",
      );
    }
    this.calls.push(now);
  },
};

// ---------------------------------------------------------------------------
// Provider implementation
// ---------------------------------------------------------------------------
export class GeminiVisionProvider implements VisionAIProvider {
  readonly providerName = "gemini";
  readonly modelName = MODEL_NAME;

  private client: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new AIProviderError(
        "GEMINI_API_KEY environment variable is not set",
        "MISSING_KEY",
        "gemini",
      );
    }
    this.client = new GoogleGenAI({ apiKey });
  }

  // -------------------------------------------------------------------------
  // Civic image analysis
  // -------------------------------------------------------------------------
  async analyzeCivicImage(input: CivicImageInput): Promise<CivicImageAnalysis> {
    rateLimiter.check();

    const base64Image = Buffer.from(input.imageBytes).toString("base64");
    const mimeType = input.contentType as
      | "image/jpeg"
      | "image/png"
      | "image/webp";

    const prompt = buildAnalysisPrompt(input.claimedCategory);

    try {
      const response = await withTimeout(
        this.client.models.generateContent({
          model: MODEL_NAME,
          contents: [
            {
              role: "user",
              parts: [
                { inlineData: { mimeType, data: base64Image } },
                { text: prompt },
              ],
            },
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: ANALYSIS_SCHEMA,
            temperature: 0.1,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
        AI_CONFIG.analysisTimeoutMs,
      );

      const text = response.text ?? "";
      const parsed = JSON.parse(text);
      return validateAnalysisResponse(parsed);
    } catch (err) {
      if (err instanceof AIProviderError) throw err;
      throw wrapError(err);
    }
  }

  // -------------------------------------------------------------------------
  // Image comparison (duplicate or resolution)
  // -------------------------------------------------------------------------
  async compareImages(input: ImageComparisonInput): Promise<ImageComparisonResult> {
    rateLimiter.check();

    const base64Image1 = Buffer.from(input.image1Bytes).toString("base64");
    const base64Image2 = Buffer.from(input.image2Bytes).toString("base64");
    const mime1 = input.image1ContentType as
      | "image/jpeg"
      | "image/png"
      | "image/webp";
    const mime2 = input.image2ContentType as
      | "image/jpeg"
      | "image/png"
      | "image/webp";

    const prompt =
      input.mode === "duplicate"
        ? DUPLICATE_COMPARISON_PROMPT
        : RESOLUTION_COMPARISON_PROMPT;

    const schema =
      input.mode === "duplicate"
        ? DUPLICATE_COMPARISON_SCHEMA
        : RESOLUTION_COMPARISON_SCHEMA;

    try {
      const response = await withTimeout(
        this.client.models.generateContent({
          model: MODEL_NAME,
          contents: [
            {
              role: "user",
              parts: [
                { inlineData: { mimeType: mime1, data: base64Image1 } },
                { inlineData: { mimeType: mime2, data: base64Image2 } },
                { text: prompt },
              ],
            },
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            temperature: 0.1,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
        AI_CONFIG.analysisTimeoutMs,
      );

      const text = response.text ?? "";
      const parsed = JSON.parse(text);

      if (input.mode === "duplicate") {
        return validateDuplicateComparison(parsed);
      }
      return validateResolutionComparison(parsed);
    } catch (err) {
      if (err instanceof AIProviderError) throw err;
      throw wrapError(err);
    }
  }
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

function buildAnalysisPrompt(claimedCategory?: string): string {
  const categoryList = Array.from(VALID_CATEGORIES).join(", ");
  const claimedPart = claimedCategory
    ? `\nThe user claims this is a "${claimedCategory}" issue. Verify whether the image actually shows this type of issue.`
    : "";

  return `You are a civic issue image analyzer for a municipal grievance system in India.

Analyze this image and determine:
1. Whether it shows a legitimate civic infrastructure issue (potholes, garbage, broken streetlights, waterlogging, broken footpaths, open drains, illegal dumping, damaged signage, fallen trees, stray animals, or other civic issues).
2. Which category it belongs to. You MUST choose exactly one from: ${categoryList}
3. Your confidence level (0.0 to 1.0).
4. Whether the image appears to be spam, irrelevant, a selfie, a meme, a screenshot, or otherwise not a genuine civic issue photo.
5. Whether multiple categories could apply.
6. A bounding box [x, y, width, height] in normalized 0-1 coordinates for the primary issue, if visible.
${claimedPart}

Important rules:
- Only use categories from the provided list. Do NOT invent new categories.
- If you're unsure, use "other" as the category with low confidence.
- Be conservative with confidence — only use > 0.8 when the issue is clearly visible.
- A photo of a person (selfie), food, indoor scene, or unrelated content should be flagged as spam.
- Return "other" for civic issues that don't clearly fit the specific categories.`;
}

const DUPLICATE_COMPARISON_PROMPT = `You are comparing two photos of potential civic infrastructure issues.

Determine whether both images show the SAME physical issue (e.g., the same pothole, same garbage dump) even if photographed from different angles, at different times of day, or with different phones.

Consider:
- Are they showing the same location/scene?
- Is the same physical defect/issue visible in both?
- Could these be two different people reporting the same problem?

Provide your confidence (0.0 to 1.0) and a brief reason.`;

const RESOLUTION_COMPARISON_PROMPT = `You are comparing a BEFORE and AFTER photo for a civic issue resolution verification.

The first image is the original reported issue. The second image is claimed to show the issue after repair/resolution.

Determine:
1. Whether both images show the same scene/location.
2. Whether the civic issue appears to have been addressed/fixed in the second image.

Consider:
- Are landmarks, surroundings, and the general scene consistent?
- Has the reported defect (pothole, garbage, etc.) been visibly repaired or cleaned?
- Be skeptical — a completely different scene likely means the wrong location was photographed.

Provide your confidence (0.0 to 1.0) and a brief reason.`;

// ---------------------------------------------------------------------------
// Gemini response schemas (structured output)
// ---------------------------------------------------------------------------

const ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    is_civic_issue: { type: Type.BOOLEAN },
    category: { type: Type.STRING },
    confidence: { type: Type.NUMBER },
    spam_suspected: { type: Type.BOOLEAN },
    reason: { type: Type.STRING },
    bbox: {
      type: Type.ARRAY,
      items: { type: Type.NUMBER },
      nullable: true,
    },
    multiple_categories: { type: Type.BOOLEAN },
    alternative_categories: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: [
    "is_civic_issue",
    "category",
    "confidence",
    "spam_suspected",
    "reason",
    "multiple_categories",
    "alternative_categories",
  ],
};

const DUPLICATE_COMPARISON_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    same_physical_issue: { type: Type.BOOLEAN },
    confidence: { type: Type.NUMBER },
    reason: { type: Type.STRING },
  },
  required: ["same_physical_issue", "confidence", "reason"],
};

const RESOLUTION_COMPARISON_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    same_scene: { type: Type.BOOLEAN },
    issue_addressed: { type: Type.BOOLEAN },
    confidence: { type: Type.NUMBER },
    reason: { type: Type.STRING },
  },
  required: ["same_scene", "issue_addressed", "confidence", "reason"],
};

// ---------------------------------------------------------------------------
// Validation — NEVER trust AI output blindly
// ---------------------------------------------------------------------------

function validateAnalysisResponse(raw: Record<string, unknown>): CivicImageAnalysis {
  const category = String(raw.category ?? "other");
  const validCategory = VALID_CATEGORIES.has(category) ? category : null;

  if (!validCategory) {
    // AI returned an invalid category — treat as fallback
    return {
      is_civic_issue: Boolean(raw.is_civic_issue),
      category: "other",
      confidence: 0, // force manual selection
      spam_suspected: Boolean(raw.spam_suspected),
      reason: `AI returned invalid category "${category}". Falling back to manual selection.`,
      bbox: null,
      multiple_categories: true,
      alternative_categories: [],
    };
  }

  const confidence = clamp(Number(raw.confidence) || 0, 0, 1);
  const bbox = validateBbox(raw.bbox);
  const altCategories = Array.isArray(raw.alternative_categories)
    ? (raw.alternative_categories as string[])
        .filter((c) => VALID_CATEGORIES.has(c) && c !== validCategory)
        .slice(0, 3)
    : [];

  return {
    is_civic_issue: Boolean(raw.is_civic_issue),
    category: validCategory as CivicImageAnalysis["category"],
    confidence,
    spam_suspected: Boolean(raw.spam_suspected),
    reason: String(raw.reason ?? "").slice(0, 500),
    bbox,
    multiple_categories: Boolean(raw.multiple_categories),
    alternative_categories: altCategories as CivicImageAnalysis["alternative_categories"],
  };
}

function validateDuplicateComparison(
  raw: Record<string, unknown>,
): DuplicateComparisonResult {
  return {
    mode: "duplicate",
    same_physical_issue: Boolean(raw.same_physical_issue),
    confidence: clamp(Number(raw.confidence) || 0, 0, 1),
    reason: String(raw.reason ?? "").slice(0, 500),
  };
}

function validateResolutionComparison(
  raw: Record<string, unknown>,
): ResolutionComparisonResult {
  return {
    mode: "resolution",
    same_scene: Boolean(raw.same_scene),
    issue_addressed: Boolean(raw.issue_addressed),
    confidence: clamp(Number(raw.confidence) || 0, 0, 1),
    reason: String(raw.reason ?? "").slice(0, 500),
  };
}

function validateBbox(
  raw: unknown,
): [number, number, number, number] | null {
  if (!Array.isArray(raw) || raw.length !== 4) return null;
  const nums = raw.map(Number);
  if (nums.some((n) => !Number.isFinite(n) || n < 0 || n > 1)) return null;
  return nums as [number, number, number, number];
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

function wrapError(err: unknown): AIProviderError {
  if (err instanceof AIProviderError) return err;
  const msg = err instanceof Error ? err.message : String(err);

  if (msg.includes("timeout") || msg.includes("TIMEOUT") || msg.includes("aborted")) {
    return new AIProviderError("Gemini API call timed out", "TIMEOUT", "gemini", err);
  }
  if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("rate")) {
    return new AIProviderError("Gemini API rate limit hit", "RATE_LIMIT", "gemini", err);
  }
  if (msg.includes("JSON") || msg.includes("parse") || msg.includes("Unexpected")) {
    return new AIProviderError("Invalid JSON from Gemini", "INVALID_RESPONSE", "gemini", err);
  }
  if (msg.includes("ENOTFOUND") || msg.includes("ECONNREFUSED") || msg.includes("fetch")) {
    return new AIProviderError("Network error reaching Gemini", "NETWORK_ERROR", "gemini", err);
  }
  return new AIProviderError(`Gemini API error: ${msg}`, "API_ERROR", "gemini", err);
}

// ---------------------------------------------------------------------------
// Timeout wrapper
// ---------------------------------------------------------------------------

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const result = await promise;
    return result;
  } catch (err) {
    if (controller.signal.aborted) {
      throw new AIProviderError("Gemini API call timed out", "TIMEOUT", "gemini");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
