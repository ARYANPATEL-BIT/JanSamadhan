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
 *   gemini         → Gemini 3.5 Flash AI analysis (sprint 2)
 *   http           → real FastAPI ML service (sprint 2 alternate)
 */
export async function getPipelineClient(): Promise<PipelineClient> {
  if (singleton) return singleton;

  const mode = process.env.PIPELINE_MODE ?? "stub";
  if (mode === "gemini") {
    // Dynamic import for reliable ESM/CJS interop in Next.js
    const mod = await import("./gemini");
    singleton = new mod.GeminiPipelineClient();
  } else if (mode === "http") {
    const mod = await import("./http");
    const url = process.env.PIPELINE_HTTP_URL;
    if (!url) throw new Error("PIPELINE_HTTP_URL required when PIPELINE_MODE=http");
    singleton = new mod.HttpPipelineClient(url);
  } else {
    singleton = new StubPipelineClient();
  }
  return singleton;
}

export type { PipelineInput, PipelineVerdict };
