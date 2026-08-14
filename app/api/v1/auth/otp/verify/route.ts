import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { verifyOtp } from "@/lib/auth/otp";
import { createSessionForPhone, destroySession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { departmentMemberships } from "@/lib/db/schema";

const Body = z.object({
  phone: z.string().min(8).max(20),
  code: z.string().regex(/^\d{6}$/),
  lang: z.enum(["en", "hi", "bn", "mr", "ta", "te"]).optional(),
  portal: z.enum(["citizen", "dept"]).default("citizen"),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const result = await verifyOtp(parsed.data.phone, parsed.data.code);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 401 });
  }

  const portal = parsed.data.portal;
  const user = await createSessionForPhone(result.phone, parsed.data.lang, portal);

  if (portal === "dept") {
    const [membership] = await db
      .select({ role: departmentMemberships.role })
      .from(departmentMemberships)
      .where(eq(departmentMemberships.userId, user.id))
      .limit(1);
    if (!membership) {
      await destroySession();
      return NextResponse.json({ error: "not_staff" }, { status: 403 });
    }
    return NextResponse.json({ ok: true, user, staffRole: membership.role });
  }

  return NextResponse.json({ ok: true, user, staffRole: null });
}
