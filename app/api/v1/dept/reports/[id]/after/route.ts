import { handleWorkPhotoPost } from "@/lib/reports/work-photo-http";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  return handleWorkPhotoPost(req, id, "AFTER");
}
