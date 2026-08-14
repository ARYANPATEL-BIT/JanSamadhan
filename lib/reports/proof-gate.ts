import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

const GEOFENCE_M = 50;

const REASONS: Record<string, string> = {
  no_assignment: "Assign field staff before submitting for citizen verification.",
  missing_before: "Upload a before-work photo first.",
  missing_after: "Upload an after-work photo first.",
  after_too_early: "The after photo must be taken after the before photo.",
};

export async function assertProofGate(reportId: string): Promise<void> {
  const rows = await db.execute<{
    ok: boolean;
    reason: string | null;
  }>(sql`
    WITH a AS (
      SELECT id, staff_id, assigned_at
      FROM assignments
      WHERE report_id = ${reportId}::uuid
      ORDER BY assigned_at DESC
      LIMIT 1
    ),
    b AS (
      SELECT captured_at, captured_lng, captured_lat
      FROM report_media
      WHERE report_id = ${reportId}::uuid AND kind = 'BEFORE'
      ORDER BY captured_at DESC NULLS LAST
      LIMIT 1
    ),
    af AS (
      SELECT captured_at, captured_lng, captured_lat
      FROM report_media
      WHERE report_id = ${reportId}::uuid AND kind = 'AFTER'
      ORDER BY captured_at DESC NULLS LAST
      LIMIT 1
    )
    SELECT
      CASE
        WHEN NOT EXISTS (SELECT 1 FROM a) THEN false
        WHEN NOT EXISTS (SELECT 1 FROM b) THEN false
        WHEN NOT EXISTS (SELECT 1 FROM af) THEN false
        WHEN (SELECT captured_at FROM af) IS NOT NULL
          AND (SELECT captured_at FROM b) IS NOT NULL
          AND (SELECT captured_at FROM af) < (SELECT captured_at FROM b) - interval '2 seconds'
          THEN false
        ELSE true
      END AS ok,
      CASE
        WHEN NOT EXISTS (SELECT 1 FROM a) THEN 'no_assignment'
        WHEN NOT EXISTS (SELECT 1 FROM b) THEN 'missing_before'
        WHEN NOT EXISTS (SELECT 1 FROM af) THEN 'missing_after'
        WHEN (SELECT captured_at FROM af) < (SELECT captured_at FROM b) - interval '2 seconds'
          THEN 'after_too_early'
        ELSE 'ok'
      END AS reason
  `);

  const [row] = rows;
  if (!row?.ok) {
    const code = row?.reason ?? "failed";
    throw new Error(`proof_gate:${REASONS[code] ?? code}`);
  }
}

export { GEOFENCE_M };
