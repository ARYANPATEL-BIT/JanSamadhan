import { NextResponse } from "next/server";
import { z } from "zod";
import { requestOtp } from "@/lib/auth/otp";

const Body = z.object({ phone: z.string().min(8).max(20) });

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  }
  const { devCode } = await requestOtp(parsed.data.phone);
  return NextResponse.json({ ok: true, ...(devCode ? { devCode } : {}) });
}
