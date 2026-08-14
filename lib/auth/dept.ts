import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { departmentMemberships } from "@/lib/db/schema";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";

export type StaffRole = "DEPT_ADMIN" | "FIELD_STAFF";

export interface DeptActor {
  user: SessionUser;
  role: StaffRole;
  departmentId: string;
  municipalityId: string;
}

export async function getDeptActor(): Promise<DeptActor | null> {
  const user = await getCurrentUser();
  if (!user || user.portal !== "dept") return null;
  const [m] = await db
    .select()
    .from(departmentMemberships)
    .where(eq(departmentMemberships.userId, user.id))
    .limit(1);
  if (!m) return null;
  return {
    user,
    role: m.role,
    departmentId: m.departmentId,
    municipalityId: m.municipalityId,
  };
}

export async function requireDeptActor(role?: StaffRole): Promise<DeptActor | NextResponse> {
  const actor = await getDeptActor();
  if (!actor) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (role && actor.role !== role) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return actor;
}

export function isActor(v: DeptActor | NextResponse): v is DeptActor {
  return !(v instanceof NextResponse);
}

export function assertReportAccess(
  actor: DeptActor,
  report: { departmentId: string | null; assigneeId?: string | null },
): NextResponse | null {
  if (!report.departmentId || report.departmentId !== actor.departmentId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (actor.role === "FIELD_STAFF" && report.assigneeId !== actor.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return null;
}
