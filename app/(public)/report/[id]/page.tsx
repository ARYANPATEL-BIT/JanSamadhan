import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { getReport } from "@/lib/services/reports";
import { categoryLabel } from "@/lib/categories";
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

  const primary = report.media.find((m) => m.kind === "REPORT") ?? report.media[0];
  const trust = report.capture_trust;

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Public Reports", href: "/feed" },
          { label: `Complaint #${id.slice(0, 8).toUpperCase()}` },
        ]}
      />
      <div className="gov-container gov-interior">
        <SidebarNav />
        <div className="gov-interior__main">
          <h1 style={{ marginBottom: "12px" }}>
            Complaint Details — {categoryLabel(report.category)}
          </h1>

          {primary && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={primary.url}
              alt={report.category}
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
            <div className="gov-card__header">Complaint Information</div>
            <div className="gov-card__body" style={{ padding: 0 }}>
              <table className="gov-table" style={{ border: "none" }}>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 600, width: "200px" }}>Complaint ID</td>
                    <td style={{ fontFamily: "monospace" }}>{report.id}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Category</td>
                    <td>{categoryLabel(report.category)}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Status</td>
                    <td>
                      <span className={statusClass(report.status)}>
                        {report.status}
                      </span>
                    </td>
                  </tr>
                  {report.municipality_name && (
                    <tr>
                      <td style={{ fontWeight: 600 }}>Ward</td>
                      <td>
                        Ward {report.ward_no}, {report.municipality_name}
                      </td>
                    </tr>
                  )}
                  {report.department_name && (
                    <tr>
                      <td style={{ fontWeight: 600 }}>Assigned Department</td>
                      <td>{report.department_name}</td>
                    </tr>
                  )}
                  <tr>
                    <td style={{ fontWeight: 600 }}>Date Reported</td>
                    <td>{new Date(report.created_at).toLocaleString("en-IN")}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Location (GPS)</td>
                    <td>
                      Lat: {report.lat.toFixed(6)}, Lng: {report.lng.toFixed(6)}
                      {" · "}
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${report.lat}&mlon=${report.lng}#map=18/${report.lat}/${report.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View on Map
                      </a>
                    </td>
                  </tr>
                  {trust !== null && (
                    <tr>
                      <td style={{ fontWeight: 600 }}>Capture Trust Score</td>
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
              ← Back to Reports
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
