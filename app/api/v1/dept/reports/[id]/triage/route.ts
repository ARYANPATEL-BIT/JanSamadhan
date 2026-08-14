import { NextResponse } from "next/server";
import { z } from "zod";
import { isActor, requireDeptActor } from "@/lib/auth/dept";
import { deptError } from "@/lib/auth/dept-http";
import { REJECT_REASONS, triageReport } from "@/lib/services/dept";

const Body = z.object({
  action: z.enum(["legitimate", "reject", "wrong_department"]),
  reason: z.enum(REJECT_REASONS).optional(),
  note: z.string().max(400).optional(),
  departmentId: z.string().uuid().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await requireDeptActor("DEPT_ADMIN");
  if (!isActor(actor)) return actor;
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  try {
    const result = await triageReport(actor, id, parsed.data.action, parsed.data);
    return NextResponse.json(result);
  } catch (e) {
    return deptError(e);
  }
}
