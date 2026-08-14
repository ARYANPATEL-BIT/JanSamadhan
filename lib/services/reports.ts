import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { reportMedia, reports, statusEvents, users } from "@/lib/db/schema";

/**
 * Civic points awarded when a citizen submits an issue that hasn't been
 * reported before (i.e. the pipeline found no duplicate). Product decision:
 * score is a plain running total, credited at submission of a NOVEL report.
 * (Note: this trades away the PRD's spam-economics guard, which only credited
 * verified/resolved reports — see CLAUDE.md.)
 */
export const CIVIC_POINTS_PER_NEW_REPORT = 10;
import { resolveDepartmentForCategory } from "@/lib/geo/ward-lookup";
import type { DraftTicket } from "@/lib/reports/draft-ticket";
import type { Category } from "@/lib/pipeline/types";

export interface CreateReportArgs {
  ticket: DraftTicket;
  reporterId: string;
  category: Category;
  description?: string | null;
}

/**
 * Finalize a draft into a real report. Writes reports + report_media +
 * the opening status_event in one transaction. Department + SLA are resolved
 * from the CITIZEN'S chosen category (which may differ from the model's
 * suggestion), against the ward captured in the signed ticket.
 */
export async function createReportFromTicket(args: CreateReportArgs): Promise<{ id: string }> {
  const { ticket, reporterId, category } = args;

  const dept = await resolveDepartmentForCategory(ticket.municipalityId, category);

  const slaDueAt = dept ? new Date(Date.now() + dept.slaHours * 3600 * 1000) : null;

  return db.transaction(async (tx) => {
    const inserted = await tx.execute<{ id: string }>(sql`
      INSERT INTO reports (
        reporter_id, category, category_confidence, location, ward_id,
        department_id, status, capture_trust, sla_due_at, description,
        possible_duplicate, pipeline_combined,
        spam_flag, duplicate_flag, ai_analysis_status, ai_reason
      ) VALUES (
        ${reporterId},
        ${category}::category,
        ${ticket.categoryConfidence},
        ST_SetSRID(ST_MakePoint(${ticket.lng}, ${ticket.lat}), 4326)::geography,
        ${ticket.wardId},
        ${dept?.departmentId ?? null},
        'SUBMITTED',
        ${ticket.captureTrust},
        ${slaDueAt ? slaDueAt.toISOString() : null},
        ${args.description ?? null},
        ${ticket.combined === "DUPLICATE_CANDIDATES"},
        ${ticket.combined},
        ${ticket.spamSuspected ?? false},
        ${ticket.combined === "DUPLICATE_CANDIDATES"},
        ${ticket.aiAnalysisStatus ?? "skipped"},
        ${null}
      )
      RETURNING id
    `);
    const reportId = inserted[0].id;

    await tx.insert(reportMedia).values({
      reportId,
      kind: "REPORT",
      url: ticket.url,
      sha256: ticket.sha256,
      capturePath: ticket.capturePath,
      capturedAt: new Date(ticket.capturedAt),
      capturedLng: ticket.lng,
      capturedLat: ticket.lat,
      gpsAccuracyM: ticket.gpsAccuracyM ?? null,
      exifPresent: false,
    });

    await tx.insert(statusEvents).values({
      reportId,
      fromStatus: null,
      toStatus: "SUBMITTED",
      actorId: reporterId,
      note: "Report submitted",
    });

    // Award civic points only for a novel report (no duplicate found). In
    // sprint 1 the stub never reports duplicates, so every submission is novel;
    // the gate is already wired for sprint-2 duplicate detection.
    const isNovel = ticket.combined !== "DUPLICATE_CANDIDATES";
    if (isNovel) {
      await tx
        .update(users)
        .set({ civicScore: sql`${users.civicScore} + ${CIVIC_POINTS_PER_NEW_REPORT}` })
        .where(eq(users.id, reporterId));
    }

    return { id: reportId };
  });
}

export interface FeedItem {
  id: string;
  category: string;
  status: string;
  lng: number;
  lat: number;
  upvoteCount: number;
  createdAt: string;
  wardNo: number | null;
  municipalityName: string | null;
  thumbnailUrl: string | null;
  viewerUpvoted: boolean;
}

/**
 * Public feed (§7.2). Sprint-1 ordering is recency-decayed upvotes with an
 * unresolved-status boost — deliberately separate from the department priority
 * score. Full distance-from-viewer weighting lands later.
 */
export async function listFeed(viewerId: string | null): Promise<FeedItem[]> {
  const rows = await db.execute<{
    id: string;
    category: string;
    status: string;
    lng: number;
    lat: number;
    upvote_count: number | string;
    created_at: string;
    ward_no: number | null;
    municipality_name: string | null;
    viewer_upvoted: boolean | string;
  }>(sql`
    SELECT
      r.id,
      r.category::text AS category,
      r.status::text AS status,
      ST_X(r.location::geometry) AS lng,
      ST_Y(r.location::geometry) AS lat,
      r.upvote_count,
      r.created_at,
      w.ward_no,
      m.name AS municipality_name,
      ${viewerId
        ? sql`EXISTS (SELECT 1 FROM upvotes u WHERE u.report_id = r.id AND u.user_id = ${viewerId})`
        : sql`false`} AS viewer_upvoted
    FROM reports r
    LEFT JOIN wards w ON w.id = r.ward_id
    LEFT JOIN municipalities m ON m.id = w.municipality_id
    WHERE r.parent_report_id IS NULL
    ORDER BY
      (CASE WHEN r.status IN ('RESOLVED','REJECTED') THEN 0 ELSE 1 END) DESC,
      (r.upvote_count + 1) / POWER((EXTRACT(EPOCH FROM (now() - r.created_at)) / 3600) + 2, 1.5) DESC,
      r.created_at DESC
    LIMIT 50
  `);

  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    status: r.status,
    lng: r.lng,
    lat: r.lat,
    upvoteCount: Number(r.upvote_count) || 0,
    createdAt: r.created_at,
    wardNo: r.ward_no,
    municipalityName: r.municipality_name,
    thumbnailUrl: null,
    viewerUpvoted: r.viewer_upvoted === true || r.viewer_upvoted === "t",
  }));
}

export async function getReport(id: string, viewerId: string | null) {
  const [row] = await db.execute<{
    id: string;
    category: string;
    status: string;
    reporter_id: string;
    lng: number;
    lat: number;
    upvote_count: number | string;
    created_at: string;
    ward_no: number | null;
    municipality_name: string | null;
    department_name: string | null;
    capture_trust: number | null;
    category_confidence: number | null;
    spam_flag: boolean | string;
    duplicate_flag: boolean | string;
    ai_analysis_status: string | null;
    ai_reason: string | null;
    viewer_upvoted: boolean | string;
  }>(sql`
    SELECT
      r.id,
      r.category::text AS category,
      r.status::text AS status,
      r.reporter_id,
      ST_X(r.location::geometry) AS lng,
      ST_Y(r.location::geometry) AS lat,
      r.upvote_count,
      r.created_at,
      r.capture_trust,
      r.category_confidence,
      r.spam_flag,
      r.duplicate_flag,
      r.ai_analysis_status,
      r.ai_reason,
      w.ward_no,
      m.name AS municipality_name,
      d.name AS department_name,
      ${viewerId
        ? sql`EXISTS (SELECT 1 FROM upvotes u WHERE u.report_id = r.id AND u.user_id = ${viewerId})`
        : sql`false`} AS viewer_upvoted
    FROM reports r
    LEFT JOIN wards w ON w.id = r.ward_id
    LEFT JOIN municipalities m ON m.id = w.municipality_id
    LEFT JOIN departments d ON d.id = r.department_id
    WHERE r.id = ${id}
    LIMIT 1
  `);
  if (!row) return null;

  const media = await db
    .select({ url: reportMedia.url, kind: reportMedia.kind })
    .from(reportMedia)
    .where(eq(reportMedia.reportId, id))
    .orderBy(reportMedia.id);

  return {
    ...row,
    upvote_count: Number(row.upvote_count) || 0,
    viewer_upvoted: row.viewer_upvoted === true || row.viewer_upvoted === "t",
    spam_flag: row.spam_flag === true || row.spam_flag === "t",
    duplicate_flag: row.duplicate_flag === true || row.duplicate_flag === "t",
    media,
  };
}

/** Toggle one upvote per user per report; keeps reports.upvote_count in sync. */
export async function toggleUpvote(
  userId: string,
  reportId: string,
): Promise<{ upvoted: boolean; count: number }> {
  // One statement so a double-click cannot insert then immediately delete,
  // and Neon is not hit with a 4-roundtrip transaction (those were taking 3–6s).
  const rows = await db.execute<{ count: number | string; upvoted: boolean | string }>(sql`
    WITH del AS (
      DELETE FROM upvotes
      WHERE user_id = ${userId}::uuid AND report_id = ${reportId}::uuid
      RETURNING 1
    ),
    ins AS (
      INSERT INTO upvotes (user_id, report_id, weight)
      SELECT ${userId}::uuid, ${reportId}::uuid, 1
      WHERE NOT EXISTS (SELECT 1 FROM del)
      RETURNING 1
    )
    UPDATE reports
    SET upvote_count = GREATEST(
      upvote_count + CASE WHEN EXISTS (SELECT 1 FROM ins) THEN 1 ELSE -1 END,
      0
    )
    WHERE id = ${reportId}::uuid
    RETURNING upvote_count AS count, EXISTS (SELECT 1 FROM ins) AS upvoted
  `);

  const row = rows[0];
  if (!row) {
    throw new Error("report_not_found");
  }
  return { upvoted: row.upvoted === true || row.upvoted === "t", count: Number(row.count) || 0 };
}
