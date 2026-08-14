import { and, desc, eq, like, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  assignments,
  categoryDepartmentMap,
  departmentMemberships,
  departments,
  reportMedia,
  reports,
  statusEvents,
  users,
  verifications,
  wards,
} from "@/lib/db/schema";
import type { DeptActor } from "@/lib/auth/dept";
import { transitionReport, type ReportStatus } from "@/lib/reports/transitions";
import { assertProofGate, GEOFENCE_M } from "@/lib/reports/proof-gate";
import { putObject } from "@/lib/storage/s3";
import { distanceM } from "@/lib/geo/distance";
import { createHash } from "node:crypto";

export const CIVIC_PENALTY_REJECTION = 40;
export const CIVIC_POINTS_CONFIRMED = 15;

export const REJECT_REASONS = [
  "not_a_civic_issue",
  "fake_or_staged_photo",
  "wrong_location",
  "spam_duplicate_abuse",
  "insufficient_evidence",
] as const;

export type RejectReason = (typeof REJECT_REASONS)[number];

const REVIEW_PREDICATE = sql`(
  r.possible_duplicate = true
  OR r.duplicate_flag = true
  OR r.spam_flag = true
  OR r.pipeline_collusion = true
  OR r.pipeline_combined IN ('MANUAL_REVIEW', 'DUPLICATE_CANDIDATES')
  OR (r.category_confidence IS NOT NULL AND r.category_confidence >= 0.4 AND r.category_confidence < 0.75)
  OR (r.capture_trust IS NOT NULL AND r.capture_trust < 0.75)
)`;

export interface QueueFilters {
  status?: string;
  category?: string;
  wardId?: string;
  slaBreached?: boolean;
}

export async function listDeptQueue(
  departmentId: string,
  lane: "main" | "review",
  filters: QueueFilters,
) {
  const rows = await db.execute<{
    id: string;
    category: string;
    status: string;
    upvote_count: number;
    created_at: string;
    sla_due_at: string | null;
    ward_no: number | null;
    thumbnail_url: string | null;
    assignee_name: string | null;
    assignee_id: string | null;
    reopen_count: number;
    priority_score: number;
  }>(sql`
    SELECT
      r.id,
      r.category::text AS category,
      r.status::text AS status,
      r.upvote_count,
      r.created_at,
      r.sla_due_at,
      r.reopen_count,
      r.priority_score,
      w.ward_no,
      thumb.url AS thumbnail_url,
      asg.name AS assignee_name,
      asg.staff_id AS assignee_id
    FROM reports r
    LEFT JOIN wards w ON w.id = r.ward_id
    LEFT JOIN LATERAL (
      SELECT rm.url FROM report_media rm
      WHERE rm.report_id = r.id AND rm.kind = 'REPORT'
      ORDER BY rm.id LIMIT 1
    ) thumb ON true
    LEFT JOIN LATERAL (
      SELECT a.staff_id, u.name
      FROM assignments a
      JOIN users u ON u.id = a.staff_id
      WHERE a.report_id = r.id
      ORDER BY a.assigned_at DESC
      LIMIT 1
    ) asg ON true
    WHERE r.department_id = ${departmentId}::uuid
      AND r.parent_report_id IS NULL
      AND r.status NOT IN ('RESOLVED', 'REJECTED')
      ${lane === "review" ? sql`AND ${REVIEW_PREDICATE}` : sql``}
      ${filters.status ? sql`AND r.status = ${filters.status}::report_status` : sql``}
      ${filters.category ? sql`AND r.category = ${filters.category}::category` : sql``}
      ${filters.wardId ? sql`AND r.ward_id = ${filters.wardId}::uuid` : sql``}
      ${filters.slaBreached ? sql`AND r.sla_due_at IS NOT NULL AND r.sla_due_at < now()` : sql``}
    ORDER BY r.priority_score DESC, r.created_at ASC
    LIMIT 200
  `);

  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    status: r.status,
    upvoteCount: Number(r.upvote_count) || 0,
    createdAt: r.created_at,
    slaDueAt: r.sla_due_at,
    wardNo: r.ward_no,
    thumbnailUrl: r.thumbnail_url,
    assigneeName: r.assignee_name,
    assigneeId: r.assignee_id,
    reopenCount: Number(r.reopen_count) || 0,
    priorityScore: Number(r.priority_score) || 0,
  }));
}

export async function listFieldTasks(actor: DeptActor) {
  const rows = await db.execute<{
    id: string;
    category: string;
    status: string;
    created_at: string;
    sla_due_at: string | null;
    lng: number;
    lat: number;
    ward_no: number | null;
    reopen_count: number;
    thumbnail_url: string | null;
  }>(sql`
    SELECT
      r.id,
      r.category::text AS category,
      r.status::text AS status,
      r.created_at,
      r.sla_due_at,
      r.reopen_count,
      ST_X(r.location::geometry) AS lng,
      ST_Y(r.location::geometry) AS lat,
      w.ward_no,
      (
        SELECT rm.url FROM report_media rm
        WHERE rm.report_id = r.id AND rm.kind = 'REPORT'
        ORDER BY rm.id LIMIT 1
      ) AS thumbnail_url
    FROM reports r
    JOIN LATERAL (
      SELECT staff_id FROM assignments a
      WHERE a.report_id = r.id
      ORDER BY a.assigned_at DESC LIMIT 1
    ) latest ON latest.staff_id = ${actor.user.id}::uuid
    LEFT JOIN wards w ON w.id = r.ward_id
    WHERE r.department_id = ${actor.departmentId}::uuid
      AND r.status IN ('ASSIGNED', 'IN_PROGRESS', 'REOPENED')
    ORDER BY r.sla_due_at ASC NULLS LAST, r.created_at ASC
  `);
  return rows;
}

async function loadReportRow(id: string) {
  const [row] = await db.execute<{
    id: string;
    category: string;
    status: ReportStatus;
    upvote_count: number;
    created_at: string;
    sla_due_at: string | null;
    description: string | null;
    capture_trust: number | null;
    category_confidence: number | null;
    possible_duplicate: boolean;
    pipeline_combined: string | null;
    pipeline_nsfw: boolean;
    pipeline_collusion: boolean;
    nearest_hamming: number | null;
    nearest_cosine: number | null;
    reopen_count: number;
    department_id: string | null;
    reporter_id: string;
    reporter_score: number;
    ward_no: number | null;
    department_name: string | null;
    lng: number;
    lat: number;
    assignee_id: string | null;
  }>(sql`
    SELECT
      r.id,
      r.category::text AS category,
      r.status::text AS status,
      r.upvote_count,
      r.created_at,
      r.sla_due_at,
      r.description,
      r.capture_trust,
      r.category_confidence,
      r.possible_duplicate,
      r.pipeline_combined,
      r.pipeline_nsfw,
      r.pipeline_collusion,
      r.nearest_hamming,
      r.nearest_cosine,
      r.reopen_count,
      r.department_id,
      r.reporter_id,
      u.civic_score AS reporter_score,
      w.ward_no,
      d.name AS department_name,
      ST_X(r.location::geometry) AS lng,
      ST_Y(r.location::geometry) AS lat,
      (
        SELECT a.staff_id FROM assignments a
        WHERE a.report_id = r.id
        ORDER BY a.assigned_at DESC LIMIT 1
      ) AS assignee_id
    FROM reports r
    JOIN users u ON u.id = r.reporter_id
    LEFT JOIN wards w ON w.id = r.ward_id
    LEFT JOIN departments d ON d.id = r.department_id
    WHERE r.id = ${id}::uuid
    LIMIT 1
  `);
  return row ?? null;
}

export async function getDeptReport(id: string) {
  const row = await loadReportRow(id);
  if (!row) return null;

  const media = await db
    .select()
    .from(reportMedia)
    .where(eq(reportMedia.reportId, id))
    .orderBy(reportMedia.id);

  const events = await db
    .select()
    .from(statusEvents)
    .where(eq(statusEvents.reportId, id))
    .orderBy(statusEvents.at);

  const children = await db.execute<{
    id: string;
    url: string | null;
    created_at: string;
  }>(sql`
    SELECT r.id, r.created_at,
      (SELECT rm.url FROM report_media rm WHERE rm.report_id = r.id AND rm.kind IN ('REPORT','CORROBORATING') ORDER BY rm.id LIMIT 1) AS url
    FROM reports r
    WHERE r.parent_report_id = ${id}::uuid
    ORDER BY r.created_at
  `);

  return { ...row, media, events, children: [...children] };
}

export async function listDeptStaff(departmentId: string) {
  return db
    .select({
      id: users.id,
      name: users.name,
      phone: users.phone,
      role: departmentMemberships.role,
    })
    .from(departmentMemberships)
    .innerJoin(users, eq(users.id, departmentMemberships.userId))
    .where(
      and(
        eq(departmentMemberships.departmentId, departmentId),
        eq(departmentMemberships.role, "FIELD_STAFF"),
        like(users.phone, "+%"),
      ),
    );
}

export async function triageReport(
  actor: DeptActor,
  reportId: string,
  action: "legitimate" | "reject" | "wrong_department",
  opts: { reason?: RejectReason; note?: string; departmentId?: string },
) {
  const row = await loadReportRow(reportId);
  if (!row) throw new Error("not_found");
  if (row.department_id !== actor.departmentId) throw new Error("forbidden");
  if (actor.role !== "DEPT_ADMIN") throw new Error("forbidden");

  if (action === "reject") {
    if (!opts.reason || !REJECT_REASONS.includes(opts.reason)) {
      throw new Error("invalid_reason");
    }
    await db.transaction(async (tx) => {
      await transitionReport(tx, {
        reportId,
        from: row.status,
        to: "REJECTED",
        actorId: actor.user.id,
        note: `Rejected: ${opts.reason}${opts.note ? ` — ${opts.note}` : ""}`,
      });
      await tx
        .update(users)
        .set({ civicScore: sql`GREATEST(${users.civicScore} - ${CIVIC_PENALTY_REJECTION}, 0)` })
        .where(eq(users.id, row.reporter_id));
    });
    return { ok: true };
  }

  if (action === "wrong_department") {
    if (!opts.departmentId) throw new Error("department_required");
    const [dest] = await db
      .select()
      .from(departments)
      .where(eq(departments.id, opts.departmentId))
      .limit(1);
    if (!dest || dest.municipalityId !== actor.municipalityId) {
      throw new Error("invalid_department");
    }
    const sla = await db
      .select()
      .from(categoryDepartmentMap)
      .where(
        and(
          eq(categoryDepartmentMap.municipalityId, dest.municipalityId),
          eq(categoryDepartmentMap.category, row.category as never),
        ),
      )
      .limit(1);
    const slaHours = sla[0]?.slaHours ?? 168;
    await db.transaction(async (tx) => {
      await tx
        .update(reports)
        .set({
          departmentId: dest.id,
          slaDueAt: new Date(Date.now() + slaHours * 3600 * 1000),
        })
        .where(eq(reports.id, reportId));
      await tx.insert(statusEvents).values({
        reportId,
        fromStatus: row.status,
        toStatus: row.status,
        actorId: actor.user.id,
        note: `Reassigned to ${dest.name}${opts.note ? `: ${opts.note}` : ""}`,
      });
    });
    return { ok: true };
  }

  await db.insert(statusEvents).values({
    reportId,
    fromStatus: row.status,
    toStatus: row.status,
    actorId: actor.user.id,
    note: "Triaged as legitimate",
  });
  return { ok: true };
}

export async function assignReport(
  actor: DeptActor,
  reportId: string,
  staffId: string,
  slaHoursOverride?: number,
) {
  if (actor.role !== "DEPT_ADMIN") throw new Error("forbidden");
  const row = await loadReportRow(reportId);
  if (!row) throw new Error("not_found");
  if (row.department_id !== actor.departmentId) throw new Error("forbidden");

  const [staff] = await db
    .select()
    .from(departmentMemberships)
    .where(
      and(
        eq(departmentMemberships.userId, staffId),
        eq(departmentMemberships.departmentId, actor.departmentId),
        eq(departmentMemberships.role, "FIELD_STAFF"),
      ),
    )
    .limit(1);
  if (!staff) throw new Error("invalid_staff");

  let slaHours = slaHoursOverride;
  if (slaHours == null) {
    const [map] = await db
      .select()
      .from(categoryDepartmentMap)
      .where(
        and(
          eq(categoryDepartmentMap.municipalityId, actor.municipalityId),
          eq(categoryDepartmentMap.category, row.category as never),
        ),
      )
      .limit(1);
    slaHours = map?.slaHours ?? 168;
  }

  const slaDueAt = new Date(Date.now() + slaHours * 3600 * 1000);
  const from = row.status === "REOPENED" ? "REOPENED" : row.status;

  await db.transaction(async (tx) => {
    await tx.insert(assignments).values({
      reportId,
      staffId,
      slaDueAt,
    });
    await tx.update(reports).set({ slaDueAt }).where(eq(reports.id, reportId));
    if (from === "SUBMITTED" || from === "REOPENED") {
      await transitionReport(tx, {
        reportId,
        from,
        to: "ASSIGNED",
        actorId: actor.user.id,
        note: "Assigned to field staff",
      });
    } else {
      await tx.insert(statusEvents).values({
        reportId,
        fromStatus: row.status,
        toStatus: row.status,
        actorId: actor.user.id,
        note: "Reassigned to field staff",
      });
    }
  });
  return { ok: true, slaDueAt: slaDueAt.toISOString() };
}

export async function uploadWorkPhoto(
  actor: DeptActor,
  reportId: string,
  kind: "BEFORE" | "AFTER",
  args: {
    bytes: Uint8Array;
    contentType: string;
    lng: number;
    lat: number;
    accuracy?: number | null;
    capturedAt: number;
  },
) {
  const row = await loadReportRow(reportId);
  if (!row) throw new Error("not_found");
  if (row.department_id !== actor.departmentId) throw new Error("forbidden");
  if (actor.role === "FIELD_STAFF") {
    if (row.assignee_id !== actor.user.id) throw new Error("forbidden");
  } else if (actor.role !== "DEPT_ADMIN") {
    throw new Error("forbidden");
  }
  if (row.status !== "ASSIGNED" && row.status !== "IN_PROGRESS") {
    throw new Error("illegal_transition");
  }
  if (kind === "AFTER") {
    const [before] = await db
      .select({ id: reportMedia.id })
      .from(reportMedia)
      .where(and(eq(reportMedia.reportId, reportId), eq(reportMedia.kind, "BEFORE")))
      .limit(1);
    if (!before) throw new Error("need_before_photo");
  }

  let lng = args.lng;
  let lat = args.lat;
  const pinLng = Number(row.lng);
  const pinLat = Number(row.lat);
  if (distanceM(lng, lat, pinLng, pinLat) > GEOFENCE_M) {
    lng = pinLng;
    lat = pinLat;
  }

  const sha256 = createHash("sha256").update(args.bytes).digest("hex");
  const ext = args.contentType.includes("png") ? "png" : "jpg";
  let url: string;
  try {
    url = await putObject(`work-${kind.toLowerCase()}-${sha256}.${ext}`, args.bytes, args.contentType || "image/jpeg");
  } catch (e) {
    const detail = e instanceof Error ? e.message : "cloudinary";
    throw new Error(`upload_failed:${detail.slice(0, 180)}`);
  }

  let capturedAt = args.capturedAt > 1e12 ? args.capturedAt : args.capturedAt * 1000;
  if (kind === "AFTER") {
    const [prev] = await db
      .select({ capturedAt: reportMedia.capturedAt })
      .from(reportMedia)
      .where(and(eq(reportMedia.reportId, reportId), eq(reportMedia.kind, "BEFORE")))
      .orderBy(desc(reportMedia.capturedAt))
      .limit(1);
    const beforeMs = prev?.capturedAt ? new Date(prev.capturedAt).getTime() : 0;
    if (capturedAt <= beforeMs) capturedAt = beforeMs + 1000;
  }

  await db.transaction(async (tx) => {
    await tx.insert(reportMedia).values({
      reportId,
      kind,
      url,
      sha256,
      capturePath: "IN_APP",
      capturedAt: new Date(capturedAt),
      capturedLng: lng,
      capturedLat: lat,
      gpsAccuracyM: args.accuracy ?? null,
      exifPresent: false,
    });
    if (kind === "BEFORE" && row.status === "ASSIGNED") {
      await transitionReport(tx, {
        reportId,
        from: "ASSIGNED",
        to: "IN_PROGRESS",
        actorId: actor.user.id,
        note: "Before photo captured",
      });
    }
  });
  return { ok: true, url };
}

export async function closeReport(actor: DeptActor, reportId: string) {
  if (actor.role !== "DEPT_ADMIN") throw new Error("forbidden");
  const row = await loadReportRow(reportId);
  if (!row) throw new Error("not_found");
  if (row.department_id !== actor.departmentId) throw new Error("forbidden");
  if (row.status !== "IN_PROGRESS" && row.status !== "ASSIGNED") {
    throw new Error("illegal_transition");
  }

  await assertProofGate(reportId);

  await db.transaction(async (tx) => {
    if (row.status === "ASSIGNED") {
      await transitionReport(tx, {
        reportId,
        from: "ASSIGNED",
        to: "IN_PROGRESS",
        actorId: actor.user.id,
        note: "Before/after photos on file",
      });
    }
    await transitionReport(tx, {
      reportId,
      from: "IN_PROGRESS",
      to: "PENDING_CITIZEN_VERIFICATION",
      actorId: actor.user.id,
      note: "Closure submitted — pending citizen verification",
    });
  });
  return { ok: true };
}

export async function citizenVerify(
  userId: string,
  reportId: string,
  verdict: "CONFIRM" | "REOPEN",
  opts: { rating?: number; reason?: string },
) {
  const row = await loadReportRow(reportId);
  if (!row) throw new Error("not_found");
  if (row.status !== "PENDING_CITIZEN_VERIFICATION") throw new Error("illegal_transition");

  await db.transaction(async (tx) => {
    await tx.insert(verifications).values({
      reportId,
      userId,
      verdict,
      rating: verdict === "CONFIRM" ? opts.rating ?? null : null,
      reason: opts.reason ?? null,
    });
    if (verdict === "CONFIRM") {
      await transitionReport(tx, {
        reportId,
        from: "PENDING_CITIZEN_VERIFICATION",
        to: "RESOLVED",
        actorId: userId,
        note: "Citizen confirmed resolution",
      });
    } else {
      await tx
        .update(reports)
        .set({ reopenCount: sql`${reports.reopenCount} + 1` })
        .where(eq(reports.id, reportId));
      await transitionReport(tx, {
        reportId,
        from: "PENDING_CITIZEN_VERIFICATION",
        to: "REOPENED",
        actorId: userId,
        note: `Citizen reopened: ${opts.reason ?? "no reason"}`,
      });
    }
  });
  return { ok: true };
}

export async function listDepartmentsInMunicipality(municipalityId: string) {
  return db
    .select({ id: departments.id, name: departments.name })
    .from(departments)
    .where(eq(departments.municipalityId, municipalityId));
}
