import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { getReport } from "@/lib/services/reports";
import { categoryEmoji, categoryLabel } from "@/lib/categories";
import { Badge } from "@/components/ui/badge";
import { UpvoteButton } from "@/components/upvote-button";

export const dynamic = "force-dynamic";

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const report = await getReport(id, user?.id ?? null);
  if (!report) notFound();

  const primary = report.media.find((m) => m.kind === "REPORT") ?? report.media[0];
  const trust = report.capture_trust;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/feed" className="text-sm text-muted-foreground hover:underline">
        ← Back to feed
      </Link>

      {primary && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={primary.url}
          alt={report.category}
          className="w-full rounded-lg border object-cover"
        />
      )}

      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-xl font-semibold">
            {categoryEmoji(report.category)} {categoryLabel(report.category)}
          </h1>
          <UpvoteButton
            reportId={report.id}
            initialCount={report.upvote_count}
            initialUpvoted={report.viewer_upvoted}
            authed={!!user}
          />
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge>{report.status}</Badge>
          {report.municipality_name && (
            <Badge variant="outline">
              Ward {report.ward_no}, {report.municipality_name}
            </Badge>
          )}
          {report.department_name && (
            <Badge variant="secondary">{report.department_name}</Badge>
          )}
          {trust !== null && (
            <Badge variant={trust >= 0.75 ? "secondary" : "destructive"}>
              capture trust {(trust * 100).toFixed(0)}%
            </Badge>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          Reported {new Date(report.created_at).toLocaleString()} · lat{" "}
          {report.lat.toFixed(5)}, lng {report.lng.toFixed(5)}
        </p>
      </div>
    </div>
  );
}
