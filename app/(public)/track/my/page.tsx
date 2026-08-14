import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/session";
import { listMyReports } from "@/lib/services/tracking";
import { ReportCard } from "@/components/track/report-card";
import { Breadcrumbs } from "@/components/gov/breadcrumbs";
import { SidebarNav } from "@/components/gov/sidebar-nav";

export const dynamic = "force-dynamic";

export default async function MyReportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const reports = await listMyReports(user.id);
  const t = await getTranslations("track");
  const tn = await getTranslations("nav");

  const pending = reports.filter((r) => r.needsVerification);
  const other = reports.filter((r) => !r.needsVerification);

  return (
    <>
      <Breadcrumbs
        items={[
          { label: tn("home"), href: "/" },
          { label: t("breadcrumbTrack"), href: "/track" },
          { label: t("breadcrumbMyReports") },
        ]}
      />
      <div className="gov-container gov-interior">
        <SidebarNav />
        <div className="gov-interior__main">
          <h1 style={{ marginBottom: "8px" }}>{t("myReportsTitle")}</h1>
          <p style={{ color: "var(--text-muted)", marginBottom: "24px", fontSize: "14px" }}>
            {t("myReportsDescription", { count: reports.length })}
          </p>

          {reports.length === 0 && (
            <div className="gov-card" style={{ marginBottom: "16px" }}>
              <div className="gov-card__body" style={{ textAlign: "center", padding: "32px" }}>
                <p style={{ fontSize: "16px", fontWeight: 600, marginBottom: "12px" }}>
                  {t("noReports")}
                </p>
                <Link href="/report/new" className="gov-btn gov-btn--primary">
                  {t("submitFirstReport")}
                </Link>
              </div>
            </div>
          )}

          {/* Pending verifications — pinned to top */}
          {pending.length > 0 && (
            <div style={{ marginBottom: "24px" }}>
              <h2 style={{ fontSize: "16px", marginBottom: "8px", color: "var(--gov-maroon)" }}>
                ⚠ {t("pendingVerificationTitle", { count: pending.length })}
              </h2>
              <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "12px" }}>
                {t("pendingVerificationHint")}
              </p>
              {pending.map((r) => (
                <ReportCard key={r.id} report={r} />
              ))}
            </div>
          )}

          {/* All other reports */}
          {other.length > 0 && (
            <div>
              {pending.length > 0 && (
                <h2 style={{ fontSize: "16px", marginBottom: "12px" }}>
                  {t("allReportsTitle")}
                </h2>
              )}
              {other.map((r) => (
                <ReportCard key={r.id} report={r} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
