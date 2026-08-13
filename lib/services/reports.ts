import { sql, eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { reportMedia, reports, statusEvents, upvotes, users } from "@/lib/db/schema";

/**
 * Civic points awarded when a citizen submits an issue that hasn't been
 * reported before (i.e. the pipeline found no duplicate). Product decision:
 * score is a plain running total, credited at submission of a NOVEL report.
 * (Note: this trades away the PRD's spam-economics guard, which only credited
 * verified/resolved reports — see CLAUDE.md.)
 */
export const CIVIC_POINTS_PER_NEW_REPORT = 10;
import { resolveDepartment } from "@/lib/geo/ward-lookup";
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

  const dept = ticket.municipalityId
    ? await resolveDepartment(ticket.municipalityId, category)
    : null;

  const slaDueAt = dept ? new Date(Date.now() + dept.slaHours * 3600 * 1000) : null;

  return db.transaction(async (tx) => {
    const inserted = await tx.execute<{ id: string }>(sql`
      INSERT INTO reports (
        reporter_id, category, category_confidence, location, ward_id,
        department_id, status, capture_trust, sla_due_at
      ) VALUES (
        ${reporterId},
        ${category}::category,
        ${ticket.categoryConfidence},
        ST_SetSRID(ST_MakePoint(${ticket.lng}, ${ticket.lat}), 4326)::geography,
        ${ticket.wardId},
        ${dept?.departmentId ?? null},
        'SUBMITTED',
        ${ticket.captureTrust},
        ${slaDueAt ? slaDueAt.toISOString() : null}
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
    upvote_count: number;
    created_at: string;
    ward_no: number | null;
    municipality_name: string | null;
    thumbnail_url: string | null;
    viewer_upvoted: boolean;
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
      (
        SELECT rm.url FROM report_media rm
        WHERE rm.report_id = r.id AND rm.kind = 'REPORT'
        ORDER BY rm.id LIMIT 1
      ) AS thumbnail_url,
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
    LIMIT 100
  `);

  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    status: r.status,
    lng: r.lng,
    lat: r.lat,
    upvoteCount: r.upvote_count,
    createdAt: r.created_at,
    wardNo: r.ward_no,
    municipalityName: r.municipality_name,
    thumbnailUrl: r.thumbnail_url,
    viewerUpvoted: r.viewer_upvoted,
  }));
}

export async function getReport(id: string, viewerId: string | null) {
  const [row] = await db.execute<{
    id: string;
    category: string;
    status: string;
    lng: number;
    lat: number;
    upvote_count: number;
    created_at: string;
    ward_no: number | null;
    municipality_name: string | null;
    department_name: string | null;
    capture_trust: number | null;
    viewer_upvoted: boolean;
  }>(sql`
    SELECT
      r.id,
      r.category::text AS category,
      r.status::text AS status,
      ST_X(r.location::geometry) AS lng,
      ST_Y(r.location::geometry) AS lat,
      r.upvote_count,
      r.created_at,
      r.capture_trust,
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

  return { ...row, media };
}

/** Toggle one upvote per user per report; keeps reports.upvote_count in sync. */
export async function toggleUpvote(
  userId: string,
  reportId: string,
): Promise<{ upvoted: boolean; count: number }> {
  return db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(upvotes)
      .where(and(eq(upvotes.userId, userId), eq(upvotes.reportId, reportId)))
      .limit(1);

    let upvoted: boolean;
    if (existing.length > 0) {
      await tx
        .delete(upvotes)
        .where(and(eq(upvotes.userId, userId), eq(upvotes.reportId, reportId)));
      await tx
        .update(reports)
        .set({ upvoteCount: sql`GREATEST(${reports.upvoteCount} - 1, 0)` })
        .where(eq(reports.id, reportId));
      upvoted = false;
    } else {
      // weight is a flat 1 in sprint 1; civic-score weighting is sprint 4.
      await tx.insert(upvotes).values({ userId, reportId, weight: 1 });
      await tx
        .update(reports)
        .set({ upvoteCount: sql`${reports.upvoteCount} + 1` })
        .where(eq(reports.id, reportId));
      upvoted = true;
    }

    const [row] = await tx
      .select({ count: reports.upvoteCount })
      .from(reports)
      .where(eq(reports.id, reportId))
      .limit(1);
    return { upvoted, count: row?.count ?? 0 };
  });
}
