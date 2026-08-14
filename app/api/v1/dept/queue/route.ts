import { NextResponse } from "next/server";
import { isActor, requireDeptActor } from "@/lib/auth/dept";
import { listDeptQueue } from "@/lib/services/dept";

export async function GET(req: Request) {
  const actor = await requireDeptActor("DEPT_ADMIN");
  if (!isActor(actor)) return actor;

  const url = new URL(req.url);
  const items = await listDeptQueue(actor.departmentId, "main", {
    status: url.searchParams.get("status") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    wardId: url.searchParams.get("wardId") ?? undefined,
    slaBreached: url.searchParams.get("slaBreached") === "1",
  });
  return NextResponse.json({ items });
}
