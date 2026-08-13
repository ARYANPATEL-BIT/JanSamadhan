import { createHash, randomInt } from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { otpCodes } from "@/lib/db/schema";
import { getSmsSender } from "./sms";

const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;

function authSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET missing or too short");
  return s;
}

/** Normalize to an E.164-ish digit string; default to India (+91). */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  return `+${digits}`;
}

function hashCode(phone: string, code: string): string {
  return createHash("sha256").update(`${authSecret()}:${phone}:${code}`).digest("hex");
}

/** Generate + persist a hashed OTP and dispatch it via the SmsSender. */
export async function requestOtp(rawPhone: string): Promise<{ devCode?: string }> {
  const phone = normalizePhone(rawPhone);
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");

  await db.insert(otpCodes).values({
    phone,
    codeHash: hashCode(phone, code),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });

  await getSmsSender().send(phone, code);

  // Only echoed back to the client in dev, for convenience.
  return process.env.OTP_DEV_ECHO === "true" ? { devCode: code } : {};
}

export type VerifyResult =
  | { ok: true; phone: string }
  | { ok: false; reason: "EXPIRED_OR_MISSING" | "TOO_MANY_ATTEMPTS" | "BAD_CODE" };

/** Verify a submitted code against the latest live OTP for the phone. */
export async function verifyOtp(rawPhone: string, code: string): Promise<VerifyResult> {
  const phone = normalizePhone(rawPhone);

  const [row] = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.phone, phone),
        isNull(otpCodes.consumedAt),
        gt(otpCodes.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);

  if (!row) return { ok: false, reason: "EXPIRED_OR_MISSING" };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "TOO_MANY_ATTEMPTS" };

  if (row.codeHash !== hashCode(phone, code)) {
    await db
      .update(otpCodes)
      .set({ attempts: row.attempts + 1 })
      .where(eq(otpCodes.id, row.id));
    return { ok: false, reason: "BAD_CODE" };
  }

  // Single-use: consume it.
  await db.update(otpCodes).set({ consumedAt: new Date() }).where(eq(otpCodes.id, row.id));
  return { ok: true, phone };
}
