import { NextResponse } from "next/server";
import { isActor, requireDeptActor } from "@/lib/auth/dept";
import { deptError } from "@/lib/auth/dept-http";
import { closeReport } from "@/lib/services/dept";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await requireDeptActor("DEPT_ADMIN");
  if (!isActor(actor)) return actor;
  const { id } = await params;
  try {
    return NextResponse.json(await closeReport(actor, id));
  } catch (e) {
    return deptError(e);
  }
}
