import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getReport } from "@/lib/services/reports";
import { UpvoteButton } from "@/components/upvote-button";
import { CitizenVerify } from "@/components/citizen-verify";
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
  const beforeWork = report.media.find((m) => m.kind === "BEFORE");
  const afterMedia = report.media.find((m) => m.kind === "AFTER");
  const beforeMedia = beforeWork ?? primary;
  const trust = report.capture_trust;
  const confidence = report.category_confidence;

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

          {beforeMedia && afterMedia ? (
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, marginBottom: "4px", color: "var(--text-muted)" }}>
                  BEFORE
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={beforeMedia.url}
                  alt={`${report.category} - before`}
                  style={{
                    width: "100%",
                    maxHeight: "300px",
                    objectFit: "cover",
                    border: "1px solid var(--gov-border)",
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, marginBottom: "4px", color: "var(--text-muted)" }}>
                  AFTER
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={afterMedia.url}
                  alt={`${report.category} - after`}
                  style={{
                    width: "100%",
                    maxHeight: "300px",
                    objectFit: "cover",
                    border: "1px solid var(--gov-border)",
                  }}
                />
              </div>
            </div>
          ) : primary ? (
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
          ) : null}

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

          <div className="gov-card" style={{ marginBottom: "16px" }}>
            <div className="gov-card__header">AI Analysis</div>
            <div className="gov-card__body" style={{ padding: 0 }}>
              <table className="gov-table" style={{ border: "none" }}>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 600, width: "200px" }}>AI Analysis Status</td>
                    <td>
                      <span className={
                        report.ai_analysis_status === "completed"
                          ? "gov-badge gov-badge--success"
                          : report.ai_analysis_status === "failed"
                            ? "gov-badge gov-badge--danger"
                            : "gov-badge gov-badge--saffron"
                      }>
                        {report.ai_analysis_status ?? "N/A"}
                      </span>
                    </td>
                  </tr>
                  {confidence !== null && confidence > 0 && (
                    <tr>
                      <td style={{ fontWeight: 600 }}>AI Confidence</td>
                      <td>
                        <span className={
                          confidence >= 0.75
                            ? "gov-badge gov-badge--success"
                            : confidence >= 0.5
                              ? "gov-badge gov-badge--saffron"
                              : "gov-badge gov-badge--danger"
                        }>
                          {(confidence * 100).toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td style={{ fontWeight: 600 }}>Spam Flag</td>
                    <td>
                      {report.spam_flag ? (
                        <span className="gov-badge gov-badge--danger">⚠ Flagged</span>
                      ) : (
                        <span className="gov-badge gov-badge--success">Clean</span>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Duplicate Flag</td>
                    <td>
                      {report.duplicate_flag ? (
                        <span className="gov-badge gov-badge--saffron">Possible Duplicate</span>
                      ) : (
                        <span className="gov-badge gov-badge--success">Unique</span>
                      )}
                    </td>
                  </tr>
                  {report.ai_reason && (
                    <tr>
                      <td style={{ fontWeight: 600 }}>AI Reason</td>
                      <td style={{ fontSize: "0.857rem", color: "var(--text-muted)" }}>
                        {report.ai_reason}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {user && report.status === "PENDING_CITIZEN_VERIFICATION" && (
              <CitizenVerify reportId={report.id} />
            )}

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
