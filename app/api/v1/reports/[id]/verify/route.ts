import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { citizenVerify } from "@/lib/services/dept";
import { deptError } from "@/lib/auth/dept-http";

const Body = z.object({
  verdict: z.enum(["CONFIRM", "REOPEN"]),
  rating: z.number().int().min(1).max(5).optional(),
  reason: z.string().max(400).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  try {
    return NextResponse.json(
      await citizenVerify(user.id, id, parsed.data.verdict, parsed.data),
    );
  } catch (e) {
    return deptError(e);
  }
}
