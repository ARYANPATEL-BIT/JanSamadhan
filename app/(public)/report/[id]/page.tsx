import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getReport } from "@/lib/services/reports";
import { UpvoteButton } from "@/components/upvote-button";
import { Breadcrumbs } from "@/components/gov/breadcrumbs";
import { SidebarNav } from "@/components/gov/sidebar-nav";

export const dynamic = "force-dynamic";

function statusClass(status: string): string {
  const s = status.toLowerCase().replace(/ /g, "_");
  return `gov-status gov-status--${s}`;
}

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const report = await getReport(id, user?.id ?? null);
  if (!report) notFound();

  const t = await getTranslations("reportDetail");
  const tn = await getTranslations("nav");
  const tc = await getTranslations("categories");
  const ts = await getTranslations("status");
  const category = tc(report.category);

  const primary = report.media.find((m) => m.kind === "REPORT") ?? report.media[0];
  const trust = report.capture_trust;

  return (
    <>
      <Breadcrumbs
        items={[
          { label: tn("home"), href: "/" },
          { label: tn("publicReports"), href: "/feed" },
          { label: t("breadcrumbComplaint", { id: id.slice(0, 8).toUpperCase() }) },
        ]}
      />
      <div className="gov-container gov-interior">
        <SidebarNav />
        <div className="gov-interior__main">
          <h1 style={{ marginBottom: "12px" }}>
            {t("title", { category })}
          </h1>

          {primary && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={primary.url}
              alt={category}
              style={{
                width: "100%",
                maxHeight: "400px",
                objectFit: "cover",
                border: "1px solid var(--gov-border)",
                marginBottom: "16px",
              }}
            />
          )}

          {/* Details table */}
          <div className="gov-card" style={{ marginBottom: "16px" }}>
            <div className="gov-card__header">{t("complaintInfo")}</div>
            <div className="gov-card__body" style={{ padding: 0 }}>
              <table className="gov-table" style={{ border: "none" }}>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 600, width: "200px" }}>{t("rowComplaintId")}</td>
                    <td style={{ fontFamily: "monospace" }}>{report.id}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>{t("rowCategory")}</td>
                    <td>{category}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>{t("rowStatus")}</td>
                    <td>
                      <span className={statusClass(report.status)}>
                        {ts(report.status)}
                      </span>
                    </td>
                  </tr>
                  {report.municipality_name && (
                    <tr>
                      <td style={{ fontWeight: 600 }}>{t("rowWard")}</td>
                      <td>
                        {t("wardValue", { ward: report.ward_no ?? "", municipality: report.municipality_name })}
                      </td>
                    </tr>
                  )}
                  {report.department_name && (
                    <tr>
                      <td style={{ fontWeight: 600 }}>{t("rowAssignedDept")}</td>
                      <td>{report.department_name}</td>
                    </tr>
                  )}
                  <tr>
                    <td style={{ fontWeight: 600 }}>{t("rowDateReported")}</td>
                    <td>{new Date(report.created_at).toLocaleString("en-IN")}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>{t("rowLocation")}</td>
                    <td>
                      Lat: {report.lat.toFixed(6)}, Lng: {report.lng.toFixed(6)}
                      {" · "}
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${report.lat}&mlon=${report.lng}#map=18/${report.lat}/${report.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t("viewOnMap")}
                      </a>
                    </td>
                  </tr>
                  {trust !== null && (
                    <tr>
                      <td style={{ fontWeight: 600 }}>{t("rowCaptureTrust")}</td>
                      <td>
                        <span className={trust >= 0.75 ? "gov-badge gov-badge--success" : "gov-badge gov-badge--danger"}>
                          {(trust * 100).toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Upvote */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <UpvoteButton
              reportId={report.id}
              initialCount={report.upvote_count}
              initialUpvoted={report.viewer_upvoted}
              authed={!!user}
            />
            <Link
              href="/feed"
              className="gov-btn gov-btn--secondary gov-btn--sm"
            >
              ← {t("backToReports")}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
