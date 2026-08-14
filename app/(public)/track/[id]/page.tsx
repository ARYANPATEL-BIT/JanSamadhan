import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getReportForTracking } from "@/lib/services/tracking";
import { StageStepper } from "@/components/track/stage-stepper";
import { EventTimeline } from "@/components/track/event-timeline";
import { SlaCountdown } from "@/components/track/sla-countdown";
import { VerificationPanel } from "@/components/track/verification-panel";
import { MergedNotice } from "@/components/track/merged-notice";
import { UpvoteButton } from "@/components/upvote-button";
import { Breadcrumbs } from "@/components/gov/breadcrumbs";
import { SidebarNav } from "@/components/gov/sidebar-nav";

export const dynamic = "force-dynamic";

export default async function TrackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const report = await getReportForTracking(id, user?.id ?? null);
  if (!report) notFound();

  const t = await getTranslations("track");
  const tn = await getTranslations("nav");
  const tc = await getTranslations("categories");
  const ts = await getTranslations("status");

  const category = tc(report.category);
  const primary = report.media.find((m) => m.kind === "REPORT") ?? report.media[0];
  const beforeMedia = report.media.find((m) => m.kind === "BEFORE") ?? primary;
  const afterMedia = report.media.find((m) => m.kind === "AFTER");

  const isPendingVerification = report.status === "PENDING_CITIZEN_VERIFICATION";
  const pendingEvent = report.events.find(
    (e) => e.toStatus === "PENDING_CITIZEN_VERIFICATION",
  );

  // For merged reports, redirect to the parent's tracking
  const isMerged = !!report.parentReportId;

  return (
    <>
      <Breadcrumbs
        items={[
          { label: tn("home"), href: "/" },
          { label: t("breadcrumbTrack"), href: "/track" },
          { label: t("breadcrumbDetail", { id: id.slice(0, 8).toUpperCase() }) },
        ]}
      />
      <div className="gov-container gov-interior">
        <SidebarNav />
        <div className="gov-interior__main">
          <h1 style={{ marginBottom: "4px" }}>
            {t("detailTitle", { category })}
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "16px", fontFamily: "monospace" }}>
            {t("reportId")}: {report.id}
          </p>

          {/* Merged notice */}
          {isMerged && <MergedNotice parentReportId={report.parentReportId!} />}

          {/* Stage stepper */}
          <StageStepper
            stages={report.stages}
            isRejected={report.isRejected}
            rejectionReason={report.rejectionReason}
          />

          {/* SLA countdown */}
          <div style={{ marginBottom: "16px" }}>
            <SlaCountdown
              slaDueAt={report.slaDueAt}
              closedAt={report.closedAt}
              status={report.status}
            />
          </div>

          {/* Verification panel — only for authenticated owner */}
          {report.isOwner && isPendingVerification && (
            <VerificationPanel
              reportId={report.id}
              beforeUrl={beforeMedia?.url ?? null}
              afterUrl={afterMedia?.url ?? null}
              pendingSince={pendingEvent?.at ?? null}
            />
          )}

          {/* Photos */}
          {beforeMedia && afterMedia ? (
            <div className="gov-card" style={{ marginBottom: "16px" }}>
              <div className="gov-card__header">{t("photosTitle")}</div>
              <div className="gov-card__body" style={{ padding: "12px" }}>
                <div style={{ display: "flex", gap: "8px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "4px", color: "var(--text-muted)", textTransform: "uppercase" }}>
                      {t("photoBefore")}
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={beforeMedia.url}
                      alt={`${category} - before`}
                      style={{ width: "100%", maxHeight: "300px", objectFit: "cover", border: "1px solid var(--gov-border)" }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "4px", color: "var(--text-muted)", textTransform: "uppercase" }}>
                      {t("photoAfter")}
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={afterMedia.url}
                      alt={`${category} - after`}
                      style={{ width: "100%", maxHeight: "300px", objectFit: "cover", border: "1px solid var(--gov-border)" }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : primary ? (
            <div className="gov-card" style={{ marginBottom: "16px" }}>
              <div className="gov-card__header">{t("photoTitle")}</div>
              <div className="gov-card__body" style={{ padding: "12px" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={primary.url}
                  alt={category}
                  style={{ width: "100%", maxHeight: "400px", objectFit: "cover", border: "1px solid var(--gov-border)" }}
                />
              </div>
            </div>
          ) : null}

          {/* Details table */}
          <div className="gov-card" style={{ marginBottom: "16px" }}>
            <div className="gov-card__header">{t("detailsTitle")}</div>
            <div className="gov-card__body" style={{ padding: 0 }}>
              <table className="gov-table" style={{ border: "none" }}>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 600, width: "200px" }}>{t("rowCategory")}</td>
                    <td>{category}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>{t("rowStatus")}</td>
                    <td>
                      <span className={`gov-status gov-status--${report.status.toLowerCase().replace(/ /g, "_")}`}>
                        {ts(report.status)}
                      </span>
                    </td>
                  </tr>
                  {report.departmentName && (
                    <tr>
                      <td style={{ fontWeight: 600 }}>{t("rowDepartment")}</td>
                      <td>{report.departmentName}</td>
                    </tr>
                  )}
                  {report.wardNo != null && report.municipalityName && (
                    <tr>
                      <td style={{ fontWeight: 600 }}>{t("rowWard")}</td>
                      <td>{t("wardValue", { ward: report.wardNo, municipality: report.municipalityName })}</td>
                    </tr>
                  )}
                  <tr>
                    <td style={{ fontWeight: 600 }}>{t("rowDateReported")}</td>
                    <td>{new Date(report.createdAt).toLocaleString("en-IN")}</td>
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
                  {report.reopenCount > 0 && (
                    <tr>
                      <td style={{ fontWeight: 600 }}>{t("rowReopened")}</td>
                      <td style={{ color: "var(--gov-maroon)", fontWeight: 600 }}>
                        {t("reopened", { count: report.reopenCount })}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td style={{ fontWeight: 600 }}>{t("rowUpvotes")}</td>
                    <td>
                      ▲ {report.upvoteCount}
                      {report.corroboratingCount > 0 && (
                        <span style={{ marginLeft: "8px", color: "var(--text-muted)" }}>
                          · {t("corroborating", { count: report.corroboratingCount })}
                        </span>
                      )}
                    </td>
                  </tr>
                  {report.description && (
                    <tr>
                      <td style={{ fontWeight: 600 }}>{t("rowDescription")}</td>
                      <td>{report.description}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Event timeline */}
          <EventTimeline events={report.events} />

          {/* Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
            <UpvoteButton
              reportId={report.id}
              initialCount={report.upvoteCount}
              initialUpvoted={false}
              authed={!!user}
            />
            <Link href="/track" className="gov-btn gov-btn--secondary gov-btn--sm">
              ← {t("backToSearch")}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
