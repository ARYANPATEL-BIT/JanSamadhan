import { unstable_cache } from "next/cache";
import { db } from "@/lib/db/client";
import { escalations, reports } from "@/lib/db/schema";
import { isNull, sql } from "drizzle-orm";

export const getHomeStats = unstable_cache(
  async () => {
    const [[stats], [esc]] = await Promise.all([
      db
        .select({
          total: sql<number>`count(*)`,
          resolved: sql<number>`count(*) filter (where ${reports.status} = 'RESOLVED')`,
          pending: sql<number>`count(*) filter (where ${reports.status} in (
            'SUBMITTED', 'ASSIGNED', 'IN_PROGRESS',
            'PENDING_CITIZEN_VERIFICATION', 'REOPENED'
          ))`,
        })
        .from(reports),
      db
        .select({ n: sql<number>`count(*)` })
        .from(escalations)
        .where(isNull(escalations.resolvedAt)),
    ]);
    return {
      totalReports: Number(stats?.total ?? 0),
      resolvedCount: Number(stats?.resolved ?? 0),
      pendingCount: Number(stats?.pending ?? 0),
      escalatedCount: Number(esc?.n ?? 0),
    };
  },
  ["home-stats"],
  { revalidate: 60 },
);
