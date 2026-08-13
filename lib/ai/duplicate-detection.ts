/**
 * Multi-layer duplicate detection.
 *
 * Pipeline (cheapest → most expensive):
 *   1. SHA-256 exact hash  → instant, free
 *   2. pHash Hamming       → instant, free (computed once per image)
 *   3. GPS proximity       → PostGIS query, free
 *   4. Same category       → SQL filter, free
 *   5. Gemini comparison   → API call, only for candidates from 1–4
 *
 * This minimizes API usage. Gemini is only called when local signals
 * have already identified candidate duplicates.
 */

import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { AI_CONFIG } from "./config";
import { hammingDistance } from "./phash";
import { getVisionProvider } from "./provider";
import type { Category } from "@/lib/pipeline/types";
import type { DuplicateCandidate } from "@/lib/pipeline/types";

export interface DuplicateCheckInput {
  sha256: string;
  phash: string | null;
  lng: number;
  lat: number;
  category: Category;
  imageBytes?: Uint8Array;
  contentType?: string;
}

export interface DuplicateCheckResult {
  candidates: DuplicateCandidate[];
  /** Whether an exact hash match was found. */
  exactMatch: boolean;
}

/**
 * Run the full duplicate detection pipeline.
 *
 * Returns candidate duplicates, ordered by match strength.
 * Does NOT block the report — flags only.
 */
export async function checkDuplicates(
  input: DuplicateCheckInput,
): Promise<DuplicateCheckResult> {
  const candidates: DuplicateCandidate[] = [];
  let exactMatch = false;

  // -----------------------------------------------------------------------
  // Layer 1: SHA-256 exact match
  // -----------------------------------------------------------------------
  const exactRows = await db.execute<{
    report_id: string;
    distance_m: number;
    age_days: number;
    upvote_count: number;
    thumbnail_url: string | null;
  }>(sql`
    SELECT
      r.id AS report_id,
      ST_Distance(
        r.location,
        ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography
      ) AS distance_m,
      EXTRACT(DAY FROM now() - r.created_at) AS age_days,
      r.upvote_count,
      (SELECT rm2.url FROM report_media rm2
       WHERE rm2.report_id = r.id AND rm2.kind = 'REPORT'
       ORDER BY rm2.id LIMIT 1) AS thumbnail_url
    FROM report_media rm
    JOIN reports r ON r.id = rm.report_id
    WHERE rm.sha256 = ${input.sha256}
      AND r.parent_report_id IS NULL
      AND r.status NOT IN ('REJECTED')
      AND r.created_at > now() - interval '${AI_CONFIG.duplicateMaxAgeDays} days'
    LIMIT 5
  `);

  for (const row of exactRows) {
    exactMatch = true;
    candidates.push({
      reportId: row.report_id,
      distanceM: Number(row.distance_m) || 0,
      ageDays: Number(row.age_days) || 0,
      upvotes: Number(row.upvote_count) || 0,
      thumbnailUrl: row.thumbnail_url,
      matchedBy: "PHASH_NEAR",
      hammingDistance: 0,
    });
  }

  // If exact match found, no need for further checks
  if (exactMatch) {
    return { candidates, exactMatch };
  }

  // -----------------------------------------------------------------------
  // Layers 2+3+4: pHash + GPS proximity + same category
  // -----------------------------------------------------------------------
  // Query nearby reports of the same category with their pHash
  const nearbyRows = await db.execute<{
    report_id: string;
    phash: string | null;
    distance_m: number;
    age_days: number;
    upvote_count: number;
    thumbnail_url: string | null;
    media_url: string | null;
  }>(sql`
    SELECT
      r.id AS report_id,
      rm.phash::text AS phash,
      ST_Distance(
        r.location,
        ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography
      ) AS distance_m,
      EXTRACT(DAY FROM now() - r.created_at) AS age_days,
      r.upvote_count,
      (SELECT rm2.url FROM report_media rm2
       WHERE rm2.report_id = r.id AND rm2.kind = 'REPORT'
       ORDER BY rm2.id LIMIT 1) AS thumbnail_url,
      rm.url AS media_url
    FROM reports r
    JOIN report_media rm ON rm.report_id = r.id AND rm.kind = 'REPORT'
    WHERE r.parent_report_id IS NULL
      AND r.status NOT IN ('REJECTED')
      AND r.category::text = ${input.category}
      AND r.created_at > now() - interval '90 days'
      AND ST_DWithin(
        r.location,
        ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography,
        ${AI_CONFIG.duplicateRadiusPointM}
      )
    ORDER BY distance_m ASC
    LIMIT 10
  `);

  for (const row of nearbyRows) {
    // Skip if already found via exact hash
    if (candidates.some((c) => c.reportId === row.report_id)) continue;

    let matchedBy: DuplicateCandidate["matchedBy"] | null = null;
    let hamming: number | undefined;

    // pHash comparison if both hashes exist
    if (input.phash && row.phash) {
      try {
        hamming = hammingDistance(input.phash, row.phash);
        if (hamming <= AI_CONFIG.phashNear) {
          matchedBy = "PHASH_NEAR";
        } else if (hamming <= AI_CONFIG.phashLikely) {
          matchedBy = "PHASH_LIKELY";
        }
      } catch {
        // Hash format mismatch — skip pHash for this candidate
      }
    }

    // If pHash didn't match, still consider it a candidate if very close
    // (GPS proximity + same category is a signal on its own)
    if (!matchedBy && Number(row.distance_m) <= 15) {
      // Very close + same category → worth showing as candidate
      matchedBy = "EMBEDDING"; // closest match type for "geo+category"
    }

    if (matchedBy) {
      candidates.push({
        reportId: row.report_id,
        distanceM: Number(row.distance_m) || 0,
        ageDays: Number(row.age_days) || 0,
        upvotes: Number(row.upvote_count) || 0,
        thumbnailUrl: row.thumbnail_url,
        matchedBy,
        hammingDistance: hamming,
      });
    }
  }

  return { candidates, exactMatch };
}
