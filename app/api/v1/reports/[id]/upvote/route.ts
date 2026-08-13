import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { toggleUpvote } from "@/lib/services/reports";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  // Sprint 1: no weighting, no 5km/ward gate, no rate limit — those depend on
  // civic score (sprint 4). Just toggle and keep the count in sync.
  const result = await toggleUpvote(user.id, id);
  return NextResponse.json(result);
}
