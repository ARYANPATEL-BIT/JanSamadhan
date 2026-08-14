import { NextResponse } from "next/server";
import { z } from "zod";
import { isActor, requireDeptActor } from "@/lib/auth/dept";
import { deptError } from "@/lib/auth/dept-http";
import { assignReport } from "@/lib/services/dept";

const Body = z.object({
  staffId: z.string().uuid(),
  slaHoursOverride: z.number().int().positive().max(24 * 90).optional(),
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
    return NextResponse.json(
      await assignReport(actor, id, parsed.data.staffId, parsed.data.slaHoursOverride),
    );
  } catch (e) {
    return deptError(e);
  }
}
