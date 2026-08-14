import { NextResponse } from "next/server";
import { isActor, requireDeptActor } from "@/lib/auth/dept";
import { listDepartmentsInMunicipality } from "@/lib/services/dept";

export async function GET() {
  const actor = await requireDeptActor("DEPT_ADMIN");
  if (!isActor(actor)) return actor;
  const items = await listDepartmentsInMunicipality(actor.municipalityId);
  return NextResponse.json({ items });
}
