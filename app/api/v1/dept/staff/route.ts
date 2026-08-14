import { NextResponse } from "next/server";
import { isActor, requireDeptActor } from "@/lib/auth/dept";
import { listDeptStaff } from "@/lib/services/dept";

export async function GET() {
  const actor = await requireDeptActor("DEPT_ADMIN");
  if (!isActor(actor)) return actor;
  const staff = await listDeptStaff(actor.departmentId);
  return NextResponse.json({ staff });
}
