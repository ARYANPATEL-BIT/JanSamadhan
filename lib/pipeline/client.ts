import type { PipelineInput, PipelineVerdict } from "./types";
import { StubPipelineClient } from "./stub";

/** The only thing the report flow depends on. */
export interface PipelineClient {
  analyze(input: PipelineInput): Promise<PipelineVerdict>;
}

let singleton: PipelineClient | null = null;

/**
 * Factory — chooses the implementation from PIPELINE_MODE.
 *   stub (default) → hardcoded clean verdict (sprint 1)
 *   http           → real FastAPI ML service (sprint 2)
 */
export function getPipelineClient(): PipelineClient {
  if (singleton) return singleton;

  const mode = process.env.PIPELINE_MODE ?? "stub";
  if (mode === "http") {
    // Lazy import so the stub path never pulls in HTTP-only code.
    const { HttpPipelineClient } = require("./http") as typeof import("./http");
    const url = process.env.PIPELINE_HTTP_URL;
    if (!url) throw new Error("PIPELINE_HTTP_URL required when PIPELINE_MODE=http");
    singleton = new HttpPipelineClient(url);
  } else {
    singleton = new StubPipelineClient();
  }
  return singleton;
}

export type { PipelineInput, PipelineVerdict };
