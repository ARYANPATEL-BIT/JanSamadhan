import Link from "next/link";
import { Breadcrumbs } from "@/components/gov/breadcrumbs";
import { SidebarNav } from "@/components/gov/sidebar-nav";
import { AnnouncementStrip } from "@/components/gov/announcement-strip";
import { db } from "@/lib/db/client";
import { reports } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Fetch real stats from the database
  let totalReports = 0;
  let resolvedCount = 0;
  let pendingCount = 0;
  let escalatedCount = 0;

  try {
    const [stats] = await db
      .select({
        total: sql<number>`count(*)`,
        resolved: sql<number>`count(*) filter (where ${reports.status} = 'resolved')`,
        pending: sql<number>`count(*) filter (where ${reports.status} = 'submitted' or ${reports.status} = 'in_progress')`,
        escalated: sql<number>`count(*) filter (where ${reports.status} = 'escalated')`,
      })
      .from(reports);

    totalReports = Number(stats.total);
    resolvedCount = Number(stats.resolved);
    pendingCount = Number(stats.pending);
    escalatedCount = Number(stats.escalated);
  } catch {
    // DB not available — show zeros
  }

  return (
    <>
      <Breadcrumbs items={[{ label: "Home" }]} />
      <div className="gov-container gov-interior">
        <SidebarNav />
        <div className="gov-interior__main" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

          {/* Welcome Section */}
          <div className="gov-card">
            <div className="gov-card__header">
              Welcome to JanSamadhan — Civic Grievance Redressal Portal / नागरिक शिकायत निवारण पोर्टल
            </div>
            <div className="gov-card__body">
              <p style={{ marginBottom: "8px" }}>
                JanSamadhan is the official online platform of Nagarpratinidhi Municipal Corporation for
                registration, tracking, and resolution of civic grievances. Citizens can report infrastructure
                issues such as potholes, garbage dumps, broken streetlights, waterlogging, and other civic
                problems through GPS-verified photo capture.
              </p>
              <p style={{ marginBottom: "8px" }}>
                All complaints are automatically routed to the concerned department based on ward jurisdiction
                and issue category. Citizens can track the status of their complaints in real time and view
                all public reports for transparency.
              </p>
              <p>
                <strong>For assistance:</strong> Contact the Grievance Cell at 0651-XXXXXXX or
                email grievance@nmc.gov.in during office hours (Mon–Sat, 10:00 AM – 5:00 PM).
              </p>
            </div>
          </div>

          {/* Announcements */}
          <AnnouncementStrip />

          {/* Quick Services */}
          <div>
            <h2 style={{ marginBottom: "12px" }}>Citizen Services</h2>
            <div className="gov-services-grid">
              <Link href="/report/new" className="gov-service-card">
                <span className="gov-service-card__icon">📝</span>
                <div className="gov-service-card__title">Register Complaint</div>
                <div className="gov-service-card__desc">
                  Report a civic issue with GPS-verified photo capture
                </div>
              </Link>
              <Link href="/feed" className="gov-service-card">
                <span className="gov-service-card__icon">📋</span>
                <div className="gov-service-card__title">Public Reports</div>
                <div className="gov-service-card__desc">
                  View all registered complaints and their current status
                </div>
              </Link>
              <Link href="/track" className="gov-service-card">
                <span className="gov-service-card__icon">🔍</span>
                <div className="gov-service-card__title">Track Status</div>
                <div className="gov-service-card__desc">
                  Check the resolution status of your registered complaint
                </div>
              </Link>
            </div>
          </div>

          {/* Statistics */}
          <div>
            <h2 style={{ marginBottom: "12px" }}>Portal Statistics</h2>
            <div className="gov-stats-row">
              <div className="gov-stat">
                <div className="gov-stat__number">{totalReports.toLocaleString("en-IN")}</div>
                <div className="gov-stat__label">Total Complaints</div>
              </div>
              <div className="gov-stat">
                <div className="gov-stat__number">{resolvedCount.toLocaleString("en-IN")}</div>
                <div className="gov-stat__label">Resolved</div>
              </div>
              <div className="gov-stat">
                <div className="gov-stat__number">{pendingCount.toLocaleString("en-IN")}</div>
                <div className="gov-stat__label">Pending</div>
              </div>
              <div className="gov-stat">
                <div className="gov-stat__number">{escalatedCount.toLocaleString("en-IN")}</div>
                <div className="gov-stat__label">Escalated</div>
              </div>
            </div>
          </div>

          {/* About Section */}
          <div className="gov-card">
            <div className="gov-card__header">About This Portal</div>
            <div className="gov-card__body">
              <table className="gov-table">
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 600, width: "220px" }}>Portal Name</td>
                    <td>JanSamadhan — Civic Grievance Redressal Portal</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Managing Authority</td>
                    <td>Nagarpratinidhi Municipal Corporation</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Nodal Department</td>
                    <td>IT &amp; e-Governance Division</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Coverage</td>
                    <td>All municipal wards under NMC jurisdiction</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Issue Categories</td>
                    <td>Pothole, Garbage Dump, Streetlight Outage, Waterlogging, Broken Footpath, Open Drain, Illegal Dumping, Damaged Signage, Fallen Tree, Stray Animal, Other</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Complaint SLA</td>
                    <td>72 hours for initial acknowledgement; department-specific resolution timelines as per NMC guidelines</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Important Notice */}
          <div className="gov-notice gov-notice--info">
            <strong>Important:</strong> All complaints require a GPS-verified photograph captured through the
            portal&apos;s camera. Gallery uploads are not accepted to ensure location and time authenticity.
            Duplicate and spam submissions are automatically detected by the system.
          </div>
        </div>
      </div>
    </>
  );
}
