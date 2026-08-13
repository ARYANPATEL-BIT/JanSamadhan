import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyOtp } from "@/lib/auth/otp";
import { createSessionForPhone } from "@/lib/auth/session";

const Body = z.object({
  phone: z.string().min(8).max(20),
  code: z.string().regex(/^\d{6}$/),
  lang: z.enum(["en", "hi", "bn", "mr", "ta", "te"]).optional(),
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

  const user = await createSessionForPhone(result.phone, parsed.data.lang);
  return NextResponse.json({ ok: true, user });
}
