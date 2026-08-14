import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { reports, statusEvents, type reportStatusEnum } from "@/lib/db/schema";

export type ReportStatus = (typeof reportStatusEnum.enumValues)[number];

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const ALLOWED: Record<ReportStatus, ReportStatus[]> = {
  SUBMITTED: ["ASSIGNED", "REJECTED"],
  ASSIGNED: ["IN_PROGRESS", "ASSIGNED", "REJECTED"],
  IN_PROGRESS: ["PENDING_CITIZEN_VERIFICATION", "ASSIGNED"],
  PENDING_CITIZEN_VERIFICATION: ["RESOLVED", "REOPENED"],
  REOPENED: ["ASSIGNED"],
  RESOLVED: [],
  REJECTED: [],
};

export async function transitionReport(
  tx: Tx,
  args: {
    reportId: string;
    from: ReportStatus;
    to: ReportStatus;
    actorId: string;
    note: string;
  },
): Promise<void> {
  if (!ALLOWED[args.from].includes(args.to)) {
    throw new Error(`illegal_transition:${args.from}->${args.to}`);
  }

  await tx
    .update(reports)
    .set({
      status: args.to,
      ...(args.to === "RESOLVED" || args.to === "REJECTED"
        ? { closedAt: new Date() }
        : {}),
    })
    .where(eq(reports.id, args.reportId));

  await tx.insert(statusEvents).values({
    reportId: args.reportId,
    fromStatus: args.from,
    toStatus: args.to,
    actorId: args.actorId,
    note: args.note,
  });
}
