import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { statusEvents } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const events = await db
    .select({
      id: statusEvents.id,
      fromStatus: statusEvents.fromStatus,
      toStatus: statusEvents.toStatus,
      note: statusEvents.note,
      at: statusEvents.at,
    })
    .from(statusEvents)
    .where(eq(statusEvents.reportId, id))
    .orderBy(statusEvents.at);

  return NextResponse.json(
    events.map((e) => ({
      id: e.id,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      note: e.note,
      at: e.at?.toISOString() ?? null,
      isReopen: e.toStatus === "REOPENED",
    })),
  );
}
