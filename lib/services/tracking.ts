import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  reports,
  reportMedia,
  statusEvents,
  verifications,
} from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The 6 display stages shown in the stepper (forward order). */
export const DISPLAY_STAGES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "ASSIGNED",
  "IN_PROGRESS",
  "PENDING_VERIFICATION",
  "RESOLVED",
] as const;

export type DisplayStage = (typeof DISPLAY_STAGES)[number];

export interface StageEntry {
  stage: DisplayStage;
  enteredAt: string | null;
  completedAt: string | null;
  state: "completed" | "current" | "pending" | "skipped";
}

export interface TimelineEvent {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  at: string;
  isReopen: boolean;
}

export interface TrackingReport {
  id: string;
  category: string;
  status: string;
  reporterId: string;
  lng: number;
  lat: number;
  upvoteCount: number;
  createdAt: string;
  wardNo: number | null;
  municipalityName: string | null;
  departmentName: string | null;
  description: string | null;
  slaDueAt: string | null;
  closedAt: string | null;
  reopenCount: number;
  parentReportId: string | null;
  captureTrust: number | null;
  possibleDuplicate: boolean;
  spamFlag: boolean;
  pipelineCombined: string | null;
  media: { url: string; kind: string }[];
  events: TimelineEvent[];
  stages: StageEntry[];
  isRejected: boolean;
  rejectionReason: string | null;
  corroboratingCount: number;
  verification: { verdict: string; rating: number | null; reason: string | null; at: string } | null;
  isOwner: boolean;
}

export interface MyReportItem {
  id: string;
  category: string;
  status: string;
  thumbnailUrl: string | null;
  wardNo: number | null;
  municipalityName: string | null;
  departmentName: string | null;
  createdAt: string;
  slaDueAt: string | null;
  reopenCount: number;
  upvoteCount: number;
  daysElapsed: number;
  needsVerification: boolean;
  verificationDeadline: string | null;
}

// ---------------------------------------------------------------------------
// Stage derivation algorithm
// ---------------------------------------------------------------------------

/** Map DB status to display stage. */
function mapToDisplayStage(dbStatus: string): DisplayStage | null {
  switch (dbStatus) {
    case "SUBMITTED":
      return "SUBMITTED";
    case "ASSIGNED":
      return "ASSIGNED";
    case "IN_PROGRESS":
      return "IN_PROGRESS";
    case "PENDING_CITIZEN_VERIFICATION":
      return "PENDING_VERIFICATION";
    case "RESOLVED":
      return "RESOLVED";
    case "REOPENED":
      return null; // Reopen is an event, not a stage
    case "REJECTED":
      return null; // Terminal branch
    default:
      return null;
  }
}

/**
 * Derive display stages from the status_events audit trail.
 * Handles reopen regressions by tracking the latest cycle.
 */
export function deriveStages(
  events: TimelineEvent[],
  report: { possibleDuplicate: boolean; spamFlag: boolean; pipelineCombined: string | null; captureTrust: number | null; status: string },
): StageEntry[] {
  const needsReview =
    report.possibleDuplicate ||
    report.spamFlag ||
    report.pipelineCombined === "MANUAL_REVIEW" ||
    (report.captureTrust != null && report.captureTrust < 0.75);

  // Track which stages have been reached and when
  const stageTimestamps: Map<DisplayStage, { entered: string; completed: string | null }> = new Map();
  let currentDbStatus = report.status;

  // Walk events chronologically
  for (const event of events) {
    if (event.toStatus === "REOPENED") {
      // On reopen, clear stages after SUBMITTED to start a new cycle
      // Keep SUBMITTED since that's always the beginning
      for (const stage of ["ASSIGNED", "IN_PROGRESS", "PENDING_VERIFICATION", "RESOLVED"] as DisplayStage[]) {
        stageTimestamps.delete(stage);
      }
      if (needsReview) stageTimestamps.delete("UNDER_REVIEW");
      continue;
    }

    const displayStage = mapToDisplayStage(event.toStatus);
    if (displayStage) {
      // Mark previous stage as completed
      const stageIndex = DISPLAY_STAGES.indexOf(displayStage);
      for (const [existingStage, data] of stageTimestamps) {
        const existingIndex = DISPLAY_STAGES.indexOf(existingStage);
        if (existingIndex < stageIndex && !data.completed) {
          data.completed = event.at;
        }
      }
      stageTimestamps.set(displayStage, { entered: event.at, completed: null });
    }
  }

  // If report was SUBMITTED and has review flags, insert UNDER_REVIEW
  if (needsReview && stageTimestamps.has("SUBMITTED")) {
    const submittedData = stageTimestamps.get("SUBMITTED")!;
    const assignedData = stageTimestamps.get("ASSIGNED");
    if (!stageTimestamps.has("UNDER_REVIEW")) {
      stageTimestamps.set("UNDER_REVIEW", {
        entered: submittedData.entered,
        completed: assignedData?.entered ?? null,
      });
    }
  }

  // Build stage entries
  const currentDisplayStage = mapToDisplayStage(currentDbStatus);
  const isRejected = currentDbStatus === "REJECTED";
  const isReopened = currentDbStatus === "REOPENED";

  return DISPLAY_STAGES.map((stage): StageEntry => {
    const data = stageTimestamps.get(stage);

    // Skip UNDER_REVIEW if not needed
    if (stage === "UNDER_REVIEW" && !needsReview) {
      return { stage, enteredAt: null, completedAt: null, state: "skipped" };
    }

    if (isRejected && stage !== "SUBMITTED" && stage !== "UNDER_REVIEW") {
      if (!data) return { stage, enteredAt: null, completedAt: null, state: "pending" };
    }

    if (data) {
      const isCurrent = currentDisplayStage === stage || (isReopened && stage === "ASSIGNED");
      if (isCurrent) {
        return { stage, enteredAt: data.entered, completedAt: null, state: "current" };
      }
      if (data.completed) {
        return { stage, enteredAt: data.entered, completedAt: data.completed, state: "completed" };
      }
      // Has been entered but not completed — it's the current stage
      return { stage, enteredAt: data.entered, completedAt: null, state: "current" };
    }

    return { stage, enteredAt: null, completedAt: null, state: "pending" };
  });
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getReportForTracking(
  reportId: string,
  viewerId: string | null,
): Promise<TrackingReport | null> {
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
    description: string | null;
    sla_due_at: string | null;
    closed_at: string | null;
    reopen_count: number;
    parent_report_id: string | null;
    capture_trust: number | null;
    possible_duplicate: boolean | string;
    spam_flag: boolean | string;
    pipeline_combined: string | null;
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
      r.description,
      r.sla_due_at,
      r.closed_at,
      r.reopen_count,
      r.parent_report_id,
      r.capture_trust,
      r.possible_duplicate,
      r.spam_flag,
      r.pipeline_combined,
      w.ward_no,
      m.name AS municipality_name,
      d.name AS department_name
    FROM reports r
    LEFT JOIN wards w ON w.id = r.ward_id
    LEFT JOIN municipalities m ON m.id = w.municipality_id
    LEFT JOIN departments d ON d.id = r.department_id
    WHERE r.id = ${reportId}
    LIMIT 1
  `);

  if (!row) return null;

  // Fetch media
  const media = await db
    .select({ url: reportMedia.url, kind: reportMedia.kind })
    .from(reportMedia)
    .where(eq(reportMedia.reportId, reportId))
    .orderBy(reportMedia.id);

  // Fetch status events
  const eventRows = await db
    .select({
      id: statusEvents.id,
      fromStatus: statusEvents.fromStatus,
      toStatus: statusEvents.toStatus,
      note: statusEvents.note,
      at: statusEvents.at,
    })
    .from(statusEvents)
    .where(eq(statusEvents.reportId, reportId))
    .orderBy(statusEvents.at);

  const events: TimelineEvent[] = eventRows.map((e) => ({
    id: e.id,
    fromStatus: e.fromStatus,
    toStatus: e.toStatus,
    note: e.note,
    at: e.at?.toISOString() ?? new Date().toISOString(),
    isReopen: e.toStatus === "REOPENED",
  }));

  // Fetch latest verification
  const [verRow] = await db
    .select({
      verdict: verifications.verdict,
      rating: verifications.rating,
      reason: verifications.reason,
      at: verifications.at,
    })
    .from(verifications)
    .where(eq(verifications.reportId, reportId))
    .orderBy(verifications.at)
    .limit(1);

  // Count corroborating reports (merged duplicates)
  const [corrobRow] = await db.execute<{ cnt: number | string }>(sql`
    SELECT COUNT(*)::int AS cnt FROM reports
    WHERE parent_report_id = ${reportId}
  `);

  const possibleDuplicate = row.possible_duplicate === true || row.possible_duplicate === "t";
  const spamFlag = row.spam_flag === true || row.spam_flag === "t";

  const reportData = {
    possibleDuplicate,
    spamFlag,
    pipelineCombined: row.pipeline_combined,
    captureTrust: row.capture_trust,
    status: row.status,
  };

  const stages = deriveStages(events, reportData);
  const isRejected = row.status === "REJECTED";
  const rejectionEvent = isRejected
    ? events.find((e) => e.toStatus === "REJECTED")
    : null;

  return {
    id: row.id,
    category: row.category,
    status: row.status,
    reporterId: row.reporter_id,
    lng: row.lng,
    lat: row.lat,
    upvoteCount: Number(row.upvote_count) || 0,
    createdAt: row.created_at,
    wardNo: row.ward_no,
    municipalityName: row.municipality_name,
    departmentName: row.department_name,
    description: row.description,
    slaDueAt: row.sla_due_at,
    closedAt: row.closed_at,
    reopenCount: row.reopen_count,
    parentReportId: row.parent_report_id,
    captureTrust: row.capture_trust,
    possibleDuplicate,
    spamFlag,
    pipelineCombined: row.pipeline_combined,
    media,
    events,
    stages,
    isRejected,
    rejectionReason: rejectionEvent?.note ?? null,
    corroboratingCount: Number(corrobRow?.cnt) || 0,
    verification: verRow
      ? {
          verdict: verRow.verdict,
          rating: verRow.rating,
          reason: verRow.reason,
          at: verRow.at?.toISOString() ?? "",
        }
      : null,
    isOwner: viewerId ? row.reporter_id === viewerId : false,
  };
}

export async function listMyReports(userId: string): Promise<MyReportItem[]> {
  const rows = await db.execute<{
    id: string;
    category: string;
    status: string;
    created_at: string;
    sla_due_at: string | null;
    reopen_count: number;
    upvote_count: number | string;
    ward_no: number | null;
    municipality_name: string | null;
    department_name: string | null;
    thumbnail_url: string | null;
  }>(sql`
    SELECT
      r.id,
      r.category::text AS category,
      r.status::text AS status,
      r.created_at,
      r.sla_due_at,
      r.reopen_count,
      r.upvote_count,
      w.ward_no,
      m.name AS municipality_name,
      d.name AS department_name,
      (
        SELECT rm.url FROM report_media rm
        WHERE rm.report_id = r.id AND rm.kind = 'REPORT'
        ORDER BY rm.id LIMIT 1
      ) AS thumbnail_url
    FROM reports r
    LEFT JOIN wards w ON w.id = r.ward_id
    LEFT JOIN municipalities m ON m.id = w.municipality_id
    LEFT JOIN departments d ON d.id = r.department_id
    WHERE r.reporter_id = ${userId}
    ORDER BY
      (CASE WHEN r.status = 'PENDING_CITIZEN_VERIFICATION' THEN 0 ELSE 1 END) ASC,
      r.created_at DESC
    LIMIT 50
  `);

  const now = Date.now();

  return rows.map((r) => {
    const createdMs = new Date(r.created_at).getTime();
    const daysElapsed = Math.floor((now - createdMs) / (1000 * 60 * 60 * 24));
    const needsVerification = r.status === "PENDING_CITIZEN_VERIFICATION";

    // Verification deadline: find when it entered PENDING status + 7 days
    let verificationDeadline: string | null = null;
    if (needsVerification && r.sla_due_at) {
      // Approximate: use sla_due_at or assume 7 days from status change
      // The actual deadline is computed from the status event timestamp
      verificationDeadline = r.sla_due_at;
    }

    return {
      id: r.id,
      category: r.category,
      status: r.status,
      thumbnailUrl: r.thumbnail_url,
      wardNo: r.ward_no,
      municipalityName: r.municipality_name,
      departmentName: r.department_name,
      createdAt: r.created_at,
      slaDueAt: r.sla_due_at,
      reopenCount: r.reopen_count,
      upvoteCount: Number(r.upvote_count) || 0,
      daysElapsed,
      needsVerification,
      verificationDeadline,
    };
  });
}
