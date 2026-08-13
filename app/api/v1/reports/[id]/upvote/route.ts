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
  try {
    const result = await toggleUpvote(user.id, id);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "upvote_failed";
    if (message === "report_not_found") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ error: "upvote_failed" }, { status: 500 });
  }
}
