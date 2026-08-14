import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { categoryDepartmentMap, municipalities } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import type { Category } from "@/lib/pipeline/types";

/** Seeded demo city — used when GPS is outside ward polygons. */
const FALLBACK_MUNICIPALITY_NAME = "Ranchi Municipal Corporation";

export async function getFallbackMunicipalityId(): Promise<string | null> {
  const [row] = await db
    .select({ id: municipalities.id })
    .from(municipalities)
    .where(eq(municipalities.name, FALLBACK_MUNICIPALITY_NAME))
    .limit(1);
  return row?.id ?? null;
}

export interface WardResolution {
  wardId: string;
  wardNo: number;
  municipalityId: string;
  municipalityName: string;
}

/**
 * Point-in-polygon ward lookup (§5.1 "Where"). Uses ST_Covers on geography so
 * a point exactly on a boundary still resolves. Returns null if the point is
 * outside every seeded ward.
 */
export async function resolveWard(
  lng: number,
  lat: number,
): Promise<WardResolution | null> {
  const rows = await db.execute<{
    ward_id: string;
    ward_no: number;
    municipality_id: string;
    municipality_name: string;
  }>(sql`
    SELECT w.id AS ward_id,
           w.ward_no AS ward_no,
           w.municipality_id AS municipality_id,
           m.name AS municipality_name
    FROM wards w
    JOIN municipalities m ON m.id = w.municipality_id
    WHERE ST_Covers(
      w.boundary,
      ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
    )
    LIMIT 1
  `);

  const r = rows[0];
  if (!r) return null;
  return {
    wardId: r.ward_id,
    wardNo: r.ward_no,
    municipalityId: r.municipality_id,
    municipalityName: r.municipality_name,
  };
}

export interface DepartmentResolution {
  departmentId: string;
  slaHours: number;
}

/**
 * (category, municipality) → department + SLA. The mapping is per-municipality
 * because the same category routes to different departments in different
 * cities (§5.1).
 */
export async function resolveDepartment(
  municipalityId: string,
  category: Category,
): Promise<DepartmentResolution | null> {
  const [row] = await db
    .select({
      departmentId: categoryDepartmentMap.departmentId,
      slaHours: categoryDepartmentMap.slaHours,
    })
    .from(categoryDepartmentMap)
    .where(
      and(
        eq(categoryDepartmentMap.municipalityId, municipalityId),
        eq(categoryDepartmentMap.category, category),
      ),
    )
    .limit(1);

  return row ?? null;
}

/** Route a category even when the pin missed every ward polygon. */
export async function resolveDepartmentForCategory(
  municipalityId: string | null,
  category: Category,
): Promise<DepartmentResolution | null> {
  const muni = municipalityId ?? (await getFallbackMunicipalityId());
  if (!muni) return null;
  return resolveDepartment(muni, category);
}
