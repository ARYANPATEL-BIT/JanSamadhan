/**
 * Contract for the 3-layer spam/duplicate pipeline (PRD §6, flow-antispam).
 *
 * This is the SEAM. In sprint 1 a stub returns a hardcoded clean verdict; in
 * sprint 2 an HTTP client calls the FastAPI ML service (YOLO + CLIP + pHash).
 * Both return exactly this shape, so nothing downstream (the draft endpoint,
 * the DB writes, the draft UI) changes when the real service is wired in.
 *
 * Every layer records the scores/thresholds that produced its decision so the
 * department manual-review UI is explainable (CLAUDE.md working convention).
 */

export type Category =
  | "pothole"
  | "garbage_dump"
  | "streetlight_out"
  | "waterlogging"
  | "broken_footpath"
  | "open_drain"
  | "illegal_dumping"
  | "damaged_signage"
  | "fallen_tree"
  | "stray_animal"
  | "other";

export type CapturePath = "IN_APP" | "GALLERY";

/** Bounding box in normalized [0,1] coords: [x, y, w, h]. */
export type BBox = [number, number, number, number];

/** Input handed to the pipeline for one submission attempt. */
export interface PipelineInput {
  /** SHA-256 of the raw image bytes (computed server-side, pre-ML). */
  sha256: string;
  /** Raw image bytes — the real service needs pixels; the stub ignores them. */
  bytes?: Uint8Array;
  contentType: string;
  location: { lng: number; lat: number };
  gpsAccuracyM?: number | null;
  /** Client capture timestamp (epoch ms). */
  capturedAt: number;
  /** Server receive timestamp (epoch ms) — for clock-skew trust. */
  receivedAt: number;
  capturePath: CapturePath;
}

/** Layer 1 — issue legitimacy (vision). Flags, never hard-blocks (§9.3). */
export interface Layer1Result {
  category: Category;
  confidence: number; // 0..1
  bbox: BBox | null;
  nsfw: boolean;
  /** ≥0.75 auto-accept · 0.40–0.75 manual review · <0.40 warn-but-allow. */
  decision: "AUTO_ACCEPT" | "MANUAL_REVIEW" | "WARN";
}

/** A candidate duplicate surfaced to the citizen (§4.2). */
export interface DuplicateCandidate {
  reportId: string;
  distanceM: number;
  ageDays: number;
  upvotes: number;
  thumbnailUrl: string | null;
  /** Which signal matched: pHash Hamming or CLIP-embedding cosine. */
  matchedBy: "PHASH_NEAR" | "PHASH_LIKELY" | "EMBEDDING";
  hammingDistance?: number; // ≤6 near-certain, ≤12 likely
  cosineSimilarity?: number; // ≥0.85 same-scene
}

/** Layer 2 — pHash + geospatial clustering (§6.2). */
export interface Layer2Result {
  phash: string | null; // 64-bit as a bitstring
  candidates: DuplicateCandidate[];
}

/** Layer 3 — capture attestation (§6.3). */
export interface Layer3Result {
  captureTrust: number; // 0..1
  path: CapturePath;
  lowTrust: boolean; // gallery upload without EXIF → always manual review
  exifPresent: boolean;
  collusion: boolean; // cross-report metadata match → admin review
}

export type CombinedVerdict =
  | "CLEAN_HIGH_TRUST" // straight to department queue
  | "MANUAL_REVIEW" // clean but low trust / flagged → review lane
  | "DUPLICATE_CANDIDATES" // show candidate stack to citizen
  | "REJECTED"; // NSFW/irrelevant — the only hard block (§6.1)

export interface PipelineVerdict {
  combined: CombinedVerdict;
  layer1: Layer1Result;
  layer2: Layer2Result;
  layer3: Layer3Result;
  /** The thresholds in force when this verdict was produced (explainability). */
  thresholds: {
    phashNear: number;
    phashLikely: number;
    embeddingCosine: number;
    radiusPointM: number;
    radiusLinearM: number;
    l1AutoAccept: number;
    l1ManualReview: number;
  };
  /** Which implementation produced this verdict. */
  engine: "stub" | "http";
}

/** The canonical thresholds (CLAUDE.md domain rules — do not loosen). */
export const PIPELINE_THRESHOLDS: PipelineVerdict["thresholds"] = {
  phashNear: 6,
  phashLikely: 12,
  embeddingCosine: 0.85,
  radiusPointM: 30,
  radiusLinearM: 60,
  l1AutoAccept: 0.75,
  l1ManualReview: 0.4,
};
