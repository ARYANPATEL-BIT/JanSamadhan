import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

const COOKIE = "civic_session";
const MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

function secretKey(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET missing or too short");
  return new TextEncoder().encode(s);
}

export type SessionPortal = "citizen" | "dept";

export interface SessionUser {
  id: string;
  phone: string;
  name: string | null;
  civicScore: number;
  lang: string;
  portal: SessionPortal;
}

/**
 * Find-or-create the user for a verified phone, then set a signed session
 * cookie. Called only after verifyOtp succeeds.
 */
type Lang = typeof users.$inferInsert["lang"];

export async function createSessionForPhone(
  phone: string,
  lang?: Lang,
  portal: SessionPortal = "citizen",
): Promise<SessionUser> {
  let [user] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  if (!user) {
    [user] = await db
      .insert(users)
      .values({ phone, ...(lang ? { lang } : {}) })
      .returning();
  }

  const token = await new SignJWT({ phone: user.phone, portal })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_S}s`)
    .sign(secretKey());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_S,
  });

  return toSessionUser(user, portal);
}

/** Read the current user from the session cookie, or null. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey());
    const id = payload.sub;
    if (!id) return null;
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!user) return null;
    const portal: SessionPortal = payload.portal === "dept" ? "dept" : "citizen";
    return toSessionUser(user, portal);
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

function toSessionUser(u: typeof users.$inferSelect, portal: SessionPortal): SessionUser {
  return {
    id: u.id,
    phone: u.phone,
    name: u.name,
    civicScore: u.civicScore,
    lang: u.lang,
    portal,
  };
}
