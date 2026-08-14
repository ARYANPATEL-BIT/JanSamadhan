import { useTranslations } from "next-intl";
import Link from "next/link";

interface MergedNoticeProps {
  parentReportId: string;
}

export function MergedNotice({ parentReportId }: MergedNoticeProps) {
  const t = useTranslations("track");

  return (
    <div className="merged-notice">
      <div className="merged-notice__title">{t("mergedTitle")}</div>
      <p style={{ margin: "4px 0 8px" }}>{t("mergedDescription")}</p>
      <Link
        href={`/track/${parentReportId}`}
        className="gov-btn gov-btn--primary gov-btn--sm"
      >
        {t("mergedViewParent")}
      </Link>
    </div>
  );
}
