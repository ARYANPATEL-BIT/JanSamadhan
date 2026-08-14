import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

const GEOFENCE_M = 50;

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
        WHEN (SELECT captured_lng FROM b) IS NULL OR (SELECT captured_lat FROM b) IS NULL THEN false
        WHEN (SELECT captured_lng FROM af) IS NULL OR (SELECT captured_lat FROM af) IS NULL THEN false
        WHEN (SELECT captured_at FROM b) IS NULL OR (SELECT captured_at FROM b) <= (SELECT assigned_at FROM a) THEN false
        WHEN (SELECT captured_at FROM af) IS NULL OR (SELECT captured_at FROM af) <= (SELECT captured_at FROM b) THEN false
        WHEN NOT ST_DWithin(
          (SELECT location FROM reports WHERE id = ${reportId}::uuid),
          ST_SetSRID(ST_MakePoint((SELECT captured_lng FROM b), (SELECT captured_lat FROM b)), 4326)::geography,
          ${GEOFENCE_M}
        ) THEN false
        WHEN NOT ST_DWithin(
          (SELECT location FROM reports WHERE id = ${reportId}::uuid),
          ST_SetSRID(ST_MakePoint((SELECT captured_lng FROM af), (SELECT captured_lat FROM af)), 4326)::geography,
          ${GEOFENCE_M}
        ) THEN false
        ELSE true
      END AS ok,
      CASE
        WHEN NOT EXISTS (SELECT 1 FROM a) THEN 'no_assignment'
        WHEN NOT EXISTS (SELECT 1 FROM b) THEN 'missing_before'
        WHEN NOT EXISTS (SELECT 1 FROM af) THEN 'missing_after'
        WHEN (SELECT captured_lng FROM b) IS NULL THEN 'before_ungps'
        WHEN (SELECT captured_lng FROM af) IS NULL THEN 'after_ungps'
        WHEN (SELECT captured_at FROM b) <= (SELECT assigned_at FROM a) THEN 'before_too_early'
        WHEN (SELECT captured_at FROM af) <= (SELECT captured_at FROM b) THEN 'after_too_early'
        ELSE 'geofence_or_ok'
      END AS reason
  `);

  const row = rows[0];
  if (!row?.ok) {
    throw new Error(`proof_gate:${row?.reason ?? "failed"}`);
  }
}
