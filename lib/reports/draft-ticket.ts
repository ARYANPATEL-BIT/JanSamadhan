import { SignJWT, jwtVerify } from "jose";
import type { Category, CapturePath, CombinedVerdict } from "@/lib/pipeline/types";

/**
 * A signed, short-lived record of everything the SERVER established at draft
 * time: the uploaded object, the capture facts (server-stamped received_at,
 * client captured_at, GPS), the pipeline verdict, and the resolved ward.
 *
 * The citizen edits only category/description on the draft screen; they cannot
 * forge capture_trust, received_at, or the ward — those ride inside this signed
 * ticket. This is why the draft flow needs no DB draft table (schema stays at
 * §8.1) and why received_at (used for the clock-skew trust signal) doesn't need
 * a column: it lives here and feeds capture_trust, which IS stored on reports.
 */
export interface DraftTicket {
  objectKey: string;
  url: string;
  sha256: string;
  contentType: string;
  lng: number;
  lat: number;
  gpsAccuracyM: number | null;
  capturedAt: number; // client shutter time (epoch ms)
  receivedAt: number; // server receive time (epoch ms)
  capturePath: CapturePath;
  captureTrust: number;
  wardId: string | null;
  municipalityId: string | null;
  suggestedCategory: Category;
  categoryConfidence: number;
  combined: CombinedVerdict;
  // --- AI fields (sprint 2) ---
  spamSuspected: boolean;
  aiAnalysisStatus: "completed" | "failed" | "skipped" | "pending";
}

function secretKey(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET missing or too short");
  return new TextEncoder().encode(s);
}

export async function signDraftTicket(t: DraftTicket): Promise<string> {
  return new SignJWT({ t } as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(secretKey());
}

export async function verifyDraftTicket(token: string): Promise<DraftTicket | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return (payload as { t?: DraftTicket }).t ?? null;
  } catch {
    return null;
  }
}
