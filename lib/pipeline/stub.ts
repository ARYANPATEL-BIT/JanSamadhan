import {
  PIPELINE_THRESHOLDS,
  type PipelineInput,
  type PipelineVerdict,
} from "./types";

/**
 * Sprint-1 stub. Returns a hardcoded "clean, high confidence" verdict so the
 * end-to-end report flow is testable before the ML service exists.
 *
 * It deliberately produces the SAME shape the real service will (§6): a
 * detected category at 0.90 confidence, no duplicate candidates, and a high
 * capture-trust score for the in-app path. Swapping in HttpPipelineClient
 * (sprint 2) requires zero changes upstream.
 *
 * NOTE: category here is a placeholder — real detection lands in sprint 2. The
 * draft UI lets the citizen override it, which is why manual category selection
 * is acceptable for now (§4.1 editable chip).
 */
export class StubPipelineClient {
  async analyze(input: PipelineInput): Promise<PipelineVerdict> {
    const galleryLowTrust = input.capturePath === "GALLERY";
    return {
      combined: galleryLowTrust ? "MANUAL_REVIEW" : "CLEAN_HIGH_TRUST",
      layer1: {
        category: "pothole",
        confidence: 0.9,
        bbox: [0.3, 0.4, 0.4, 0.3],
        nsfw: false,
        decision: "AUTO_ACCEPT",
      },
      layer2: {
        // pHash is computed by the real ML service; the stub leaves it null.
        phash: null,
        candidates: [],
      },
      layer3: {
        captureTrust: galleryLowTrust ? 0.5 : 0.95,
        path: input.capturePath,
        lowTrust: galleryLowTrust,
        exifPresent: false,
        collusion: false,
      },
      thresholds: PIPELINE_THRESHOLDS,
      engine: "stub",
    };
  }
}
