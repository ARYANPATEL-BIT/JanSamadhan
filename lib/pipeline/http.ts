import type { PipelineClient } from "./client";
import { type PipelineInput, type PipelineVerdict } from "./types";

/**
 * Sprint-2 implementation — placeholder. Calls the FastAPI ML service and
 * returns the identical PipelineVerdict shape. Wiring this up is a matter of
 * setting PIPELINE_MODE=http and filling in the request/response mapping; no
 * upstream code changes.
 *
 * The graceful-degradation path (PRD §8: if the GPU service is unreachable,
 * fall back to pHash-only or the stub) will live here.
 */
export class HttpPipelineClient implements PipelineClient {
  constructor(private readonly baseUrl: string) {}

  async analyze(_input: PipelineInput): Promise<PipelineVerdict> {
    // TODO(sprint2): POST multipart (bytes + gps + timestamps) to
    // `${this.baseUrl}/v1/analyze`, map the JSON response into PipelineVerdict,
    // and degrade to pHash-only on network failure.
    throw new Error(
      "HttpPipelineClient not implemented yet — set PIPELINE_MODE=stub for sprint 1.",
    );
  }
}
