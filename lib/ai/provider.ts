/**
 * AI provider factory — singleton pattern matching getPipelineClient().
 *
 * Returns the configured VisionAIProvider. Currently only Gemini is
 * implemented; adding another provider is a new class + a case here.
 *
 * If the provider cannot be instantiated (e.g. missing API key),
 * returns null so callers can fall back to manual mode.
 */

import type { VisionAIProvider } from "./types";

let singleton: VisionAIProvider | null | undefined;

/**
 * Get the vision AI provider. Returns null if no provider is available
 * (e.g. missing API key), allowing callers to degrade gracefully.
 */
export function getVisionProvider(): VisionAIProvider | null {
  if (singleton !== undefined) return singleton;

  // Check if Gemini API key is configured
  if (!process.env.GEMINI_API_KEY) {
    console.warn(
      "[AI] GEMINI_API_KEY not set — AI image analysis will be unavailable. " +
        "Reports will use manual category selection.",
    );
    singleton = null;
    return null;
  }

  try {
    // Lazy import so the module isn't loaded when AI is disabled
    const { GeminiVisionProvider } = require("./gemini-provider") as typeof import("./gemini-provider");
    singleton = new GeminiVisionProvider();
    console.log("[AI] Gemini vision provider initialized (model: gemini-2.5-flash)");
    return singleton;
  } catch (err) {
    console.error("[AI] Failed to initialize vision provider:", err);
    singleton = null;
    return null;
  }
}

/** Reset the singleton (for testing). */
export function resetVisionProvider(): void {
  singleton = undefined;
}
