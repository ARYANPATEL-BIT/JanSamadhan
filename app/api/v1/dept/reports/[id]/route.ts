import { NextResponse } from "next/server";
import { assertReportAccess, isActor, requireDeptActor } from "@/lib/auth/dept";
import { getDeptReport } from "@/lib/services/dept";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await requireDeptActor();
  if (!isActor(actor)) return actor;
  const { id } = await params;
  const report = await getDeptReport(id);
  if (!report) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const denied = assertReportAccess(actor, {
    departmentId: report.department_id,
    assigneeId: report.assignee_id,
  });
  if (denied) return denied;
  return NextResponse.json({ report });
}
