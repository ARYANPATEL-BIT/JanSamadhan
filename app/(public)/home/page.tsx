import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Breadcrumbs } from "@/components/gov/breadcrumbs";
import { SidebarNav } from "@/components/gov/sidebar-nav";
import { AnnouncementStrip } from "@/components/gov/announcement-strip";
import { CATEGORY_META } from "@/lib/categories";
import { getHomeStats } from "@/lib/services/home-stats";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const t = await getTranslations("home");
  const tc = await getTranslations("categories");
  const tn = await getTranslations("nav");

  // Localised, comma-separated list of the issue categories for the About row.
  const categoryList = Object.keys(CATEGORY_META)
    .map((c) => tc(c))
    .join(", ");

  // Fetch real stats from the database
  let totalReports = 0;
  let resolvedCount = 0;
  let pendingCount = 0;
  let escalatedCount = 0;

  try {
    const stats = await getHomeStats();
    totalReports = stats.totalReports;
    resolvedCount = stats.resolvedCount;
    pendingCount = stats.pendingCount;
    escalatedCount = stats.escalatedCount;
  } catch {
    // DB not available — show zeros
  }

  return (
    <>
      <Breadcrumbs items={[{ label: tn("home") }]} />
      <div className="gov-container gov-interior">
        <SidebarNav />
        <div className="gov-interior__main" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

          {/* Welcome Section */}
          <div className="gov-card">
            <div className="gov-card__header">
              {t("welcomeTitle")}
            </div>
            <div className="gov-card__body">
              <p style={{ marginBottom: "8px" }}>{t("welcomeP1")}</p>
              <p style={{ marginBottom: "8px" }}>{t("welcomeP2")}</p>
              <p>
                <strong>{t("assistanceLabel")}</strong> {t("assistanceText")}
              </p>
            </div>
          </div>

          {/* Announcements */}
          <AnnouncementStrip />

          {/* Quick Services */}
          <div>
            <h2 style={{ marginBottom: "12px" }}>{t("citizenServices")}</h2>
            <div className="gov-services-grid">
              <Link href="/report/new" className="gov-service-card">
                <span className="gov-service-card__icon">📝</span>
                <div className="gov-service-card__title">{t("serviceRegisterTitle")}</div>
                <div className="gov-service-card__desc">
                  {t("serviceRegisterDesc")}
                </div>
              </Link>
              <Link href="/feed" className="gov-service-card">
                <span className="gov-service-card__icon">📋</span>
                <div className="gov-service-card__title">{t("servicePublicTitle")}</div>
                <div className="gov-service-card__desc">
                  {t("servicePublicDesc")}
                </div>
              </Link>
              <Link href="/track" className="gov-service-card">
                <span className="gov-service-card__icon">🔍</span>
                <div className="gov-service-card__title">{t("serviceTrackTitle")}</div>
                <div className="gov-service-card__desc">
                  {t("serviceTrackDesc")}
                </div>
              </Link>
            </div>
          </div>

          {/* Statistics */}
          <div>
            <h2 style={{ marginBottom: "12px" }}>{t("portalStatistics")}</h2>
            <div className="gov-stats-row">
              <div className="gov-stat">
                <div className="gov-stat__number">{totalReports.toLocaleString("en-IN")}</div>
                <div className="gov-stat__label">{t("statTotal")}</div>
              </div>
              <div className="gov-stat">
                <div className="gov-stat__number">{resolvedCount.toLocaleString("en-IN")}</div>
                <div className="gov-stat__label">{t("statResolved")}</div>
              </div>
              <div className="gov-stat">
                <div className="gov-stat__number">{pendingCount.toLocaleString("en-IN")}</div>
                <div className="gov-stat__label">{t("statPending")}</div>
              </div>
              <div className="gov-stat">
                <div className="gov-stat__number">{escalatedCount.toLocaleString("en-IN")}</div>
                <div className="gov-stat__label">{t("statEscalated")}</div>
              </div>
            </div>
          </div>

          {/* About Section */}
          <div className="gov-card">
            <div className="gov-card__header">{t("aboutTitle")}</div>
            <div className="gov-card__body">
              <table className="gov-table">
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 600, width: "220px" }}>{t("rowPortalName")}</td>
                    <td>{t("valPortalName")}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>{t("rowAuthority")}</td>
                    <td>{t("valAuthority")}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>{t("rowNodalDept")}</td>
                    <td>{t("valNodalDept")}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>{t("rowCoverage")}</td>
                    <td>{t("valCoverage")}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>{t("rowCategories")}</td>
                    <td>{categoryList}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>{t("rowSla")}</td>
                    <td>{t("valSla")}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Important Notice */}
          <div className="gov-notice gov-notice--info">
            <strong>{t("importantLabel")}</strong> {t("importantText")}
          </div>
        </div>
      </div>
    </>
  );
}
