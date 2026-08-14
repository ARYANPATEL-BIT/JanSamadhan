import Link from "next/link";
import { useTranslations } from "next-intl";
import type { MyReportItem } from "@/lib/services/tracking";

interface ReportCardProps {
  report: MyReportItem;
}

export function ReportCard({ report }: ReportCardProps) {
  const t = useTranslations("track");
  const tc = useTranslations("categories");
  const ts = useTranslations("status");

  const statusClass = `gov-status gov-status--${report.status.toLowerCase().replace(/ /g, "_")}`;
  const isUrgent = report.needsVerification;

  return (
    <Link
      href={`/track/${report.id}`}
      className={`report-card ${isUrgent ? "report-card--urgent" : ""}`}
    >
      {report.thumbnailUrl && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={report.thumbnailUrl}
          alt={tc(report.category)}
          className="report-card__thumb"
        />
      )}
      <div className="report-card__body">
        <div className="report-card__title">
          {tc(report.category)}
          {report.wardNo != null && report.municipalityName && (
            <span style={{ fontWeight: 400, color: "var(--text-muted)", marginLeft: "8px" }}>
              · Ward {report.wardNo}
            </span>
          )}
        </div>
        <div className="report-card__meta">
          <span className={statusClass}>{ts(report.status)}</span>
          <span>{t("daysAgo", { days: report.daysElapsed })}</span>
          {report.upvoteCount > 0 && (
            <span>▲ {report.upvoteCount}</span>
          )}
          {report.reopenCount > 0 && (
            <span style={{ color: "var(--gov-maroon)" }}>
              {t("reopened", { count: report.reopenCount })}
            </span>
          )}
        </div>
      </div>
      {isUrgent && (
        <div className="report-card__action">
          <span className="gov-btn gov-btn--primary gov-btn--sm">
            {t("verifyNow")}
          </span>
        </div>
      )}
    </Link>
  );
}
