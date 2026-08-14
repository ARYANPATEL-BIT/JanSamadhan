import { NextResponse } from "next/server";
import { isActor, requireDeptActor } from "@/lib/auth/dept";
import { listFieldTasks } from "@/lib/services/dept";

export async function GET() {
  const actor = await requireDeptActor("FIELD_STAFF");
  if (!isActor(actor)) return actor;
  const items = await listFieldTasks(actor);
  return NextResponse.json({ items });
}
