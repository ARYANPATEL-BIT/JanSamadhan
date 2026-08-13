import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { categoryEnum } from "@/lib/db/schema";
import { verifyDraftTicket } from "@/lib/reports/draft-ticket";
import { createReportFromTicket, listFeed } from "@/lib/services/reports";

const SubmitBody = z.object({
  ticket: z.string(),
  category: z.enum(categoryEnum.enumValues),
  description: z.string().max(200).optional(),
});

/** GET /api/v1/reports — public feed. */
export async function GET() {
  const user = await getCurrentUser();
  const items = await listFeed(user?.id ?? null);
  return NextResponse.json({ items });
}

/** POST /api/v1/reports — finalize a draft into a submitted report. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = SubmitBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const ticket = await verifyDraftTicket(parsed.data.ticket);
  if (!ticket) {
    return NextResponse.json({ error: "invalid_or_expired_draft" }, { status: 400 });
  }

  const { id } = await createReportFromTicket({
    ticket,
    reporterId: user.id,
    category: parsed.data.category,
    description: parsed.data.description ?? null,
  });

  return NextResponse.json({ ok: true, id }, { status: 201 });
}
