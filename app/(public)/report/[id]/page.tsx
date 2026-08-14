import { redirect } from "next/navigation";

export default async function LegacyReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/track/${id}`);
}
