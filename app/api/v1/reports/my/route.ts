import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { listMyReports } from "@/lib/services/tracking";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const reports = await listMyReports(user.id);
  return NextResponse.json(reports);
}
