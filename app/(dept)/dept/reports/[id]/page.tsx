import { notFound, redirect } from "next/navigation";
import { getDeptActor } from "@/lib/auth/dept";
import { getDeptReport } from "@/lib/services/dept";
import { Breadcrumbs } from "@/components/gov/breadcrumbs";
import { categoryLabel } from "@/lib/categories";
import { slaLabel, slaState } from "@/components/dept/queue-table";
import { PinMap } from "@/components/dept/pin-map";
import { AdminActions } from "@/components/dept/admin-actions";
import { WorkPhotoCapture } from "@/components/dept/work-photo-capture";
import Link from "next/link";

export const dynamic = "force-dynamic";

function statusClass(status: string): string {
  return `gov-status gov-status--${status.toLowerCase()}`;
}

export default async function DeptReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await getDeptActor();
  if (!actor) redirect("/login?portal=dept");
  const { id } = await params;
  const report = await getDeptReport(id);
  if (!report) notFound();
  if (report.department_id !== actor.departmentId) notFound();
  if (actor.role === "FIELD_STAFF") {
    if (report.assignee_id !== actor.user.id) notFound();
    redirect(`/dept/tasks/${id}`);
  }

  const lng = Number(report.lng);
  const lat = Number(report.lat);
  const sla = slaState(report.created_at, report.sla_due_at);
  const citizenPhotos = report.media.filter((m) => m.kind === "REPORT" || m.kind === "CORROBORATING");
  const before = report.media.filter((m) => m.kind === "BEFORE");
  const after = report.media.filter((m) => m.kind === "AFTER");
  const lastReopen = [...report.events].reverse().find((e) => e.toStatus === "REOPENED");

  return (
    <div className="gov-container" style={{ padding: "20px 16px 40px" }}>
      <Breadcrumbs
        items={[
          { label: "Work Queue", href: "/dept/queue" },
          { label: `#${id.slice(0, 8).toUpperCase()}` },
        ]}
      />
      <h1 style={{ margin: "12px 0" }}>
        {categoryLabel(report.category)} — {id.slice(0, 8).toUpperCase()}
      </h1>
      <p style={{ marginBottom: "12px" }}>
        <span className={statusClass(report.status)}>{report.status}</span>{" "}
        <span
          className={
            sla === "over" || sla === "warn" ? "gov-badge gov-badge--danger" : "gov-badge"
          }
        >
          SLA {slaLabel(report.sla_due_at)}
        </span>
        {Number(report.reopen_count) >= 2 ? (
          <span className="gov-badge gov-badge--danger" style={{ marginLeft: "6px" }}>
            REOPEN ×{report.reopen_count}
          </span>
        ) : null}
      </p>

      {lastReopen?.note ? (
        <div className="gov-notice gov-notice--error" style={{ marginBottom: "12px" }}>
          Last reopen: {lastReopen.note}
        </div>
      ) : null}

      <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {citizenPhotos.map((m) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={m.id} src={m.url} alt="Citizen photo" style={{ width: "100%", maxHeight: "280px", objectFit: "cover", border: "1px solid var(--gov-border)" }} />
        ))}
      </div>

      <div style={{ marginTop: "16px" }}>
        <PinMap lng={lng} lat={lat} />
      </div>

      <div className="gov-card" style={{ marginTop: "16px" }}>
        <div className="gov-card__header">Report details</div>
        <div className="gov-card__body" style={{ padding: 0 }}>
          <table className="gov-table" style={{ border: "none" }}>
            <tbody>
              <tr><td style={{ fontWeight: 600, width: "200px" }}>Description</td><td>{report.description || "—"}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>Ward</td><td>{report.ward_no != null ? `Ward ${report.ward_no}` : "—"}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>Department</td><td>{report.department_name ?? "—"}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>Upvotes</td><td>{report.upvote_count}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>Reporter civic score</td><td>{report.reporter_score}</td></tr>
              <tr>
                <td style={{ fontWeight: 600 }}>GPS</td>
                <td>
                  {lat.toFixed(6)}, {lng.toFixed(6)} ·{" "}
                  <a href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`} target="_blank" rel="noopener noreferrer">Map</a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="gov-card" style={{ marginTop: "16px" }}>
        <div className="gov-card__header">ML / pipeline (advisory)</div>
        <div className="gov-card__body" style={{ padding: 0 }}>
          <table className="gov-table" style={{ border: "none" }}>
            <tbody>
              <tr><td style={{ fontWeight: 600, width: "200px" }}>Combined</td><td>{report.pipeline_combined ?? "n/a (stub)"}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>Category confidence</td><td>{report.category_confidence ?? "—"}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>Capture trust</td><td>{report.capture_trust ?? "—"}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>Possible duplicate</td><td>{report.possible_duplicate ? "yes" : "no"}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>NSFW</td><td>{report.pipeline_nsfw ? "flagged" : "no"}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>Collusion</td><td>{report.pipeline_collusion ? "flagged" : "no"}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>Nearest Hamming</td><td>{report.nearest_hamming ?? "—"}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>CLIP cosine</td><td>{report.nearest_cosine ?? "n/a"}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {report.children.length > 0 && (
        <div className="gov-card" style={{ marginTop: "16px" }}>
          <div className="gov-card__header">Linked child reports</div>
          <div className="gov-card__body">
            <ul>
              {report.children.map((c) => (
                <li key={c.id}>
                  <Link href={`/dept/reports/${c.id}`}>{c.id.slice(0, 8).toUpperCase()}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="gov-card" style={{ marginTop: "16px" }}>
        <div className="gov-card__header">Work photos</div>
        <div className="gov-card__body" style={{ display: "grid", gap: "12px", gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <strong>Before</strong>
            {before.length === 0 ? <p>—</p> : before.map((m) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={m.id} src={m.url} alt="Before" style={{ width: "100%", marginTop: "8px", border: "1px solid var(--gov-border)" }} />
            ))}
          </div>
          <div>
            <strong>After</strong>
            {after.length === 0 ? <p>—</p> : after.map((m) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={m.id} src={m.url} alt="After" style={{ width: "100%", marginTop: "8px", border: "1px solid var(--gov-border)" }} />
            ))}
          </div>
        </div>
      </div>

      {report.status === "ASSIGNED" || report.status === "IN_PROGRESS" ? (
        <>
          <WorkPhotoCapture reportId={id} kind="BEFORE" pinLng={lng} pinLat={lat} />
          {report.status === "IN_PROGRESS" ? (
            <WorkPhotoCapture reportId={id} kind="AFTER" pinLng={lng} pinLat={lat} />
          ) : (
            <div className="gov-notice gov-notice--info" style={{ marginTop: "16px" }}>
              After photo unlocks once a before photo is saved.
            </div>
          )}
        </>
      ) : null}

      <div className="gov-card" style={{ marginTop: "16px" }}>
        <div className="gov-card__header">Timeline</div>
        <div className="gov-card__body" style={{ padding: 0 }}>
          <table className="gov-table" style={{ border: "none" }}>
            <thead>
              <tr>
                <th>When</th>
                <th>From</th>
                <th>To</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {report.events.map((e) => (
                <tr key={e.id}>
                  <td>{new Date(e.at).toLocaleString("en-IN")}</td>
                  <td>{e.fromStatus ?? "—"}</td>
                  <td>{e.toStatus}</td>
                  <td>{e.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AdminActions reportId={id} status={report.status} />
    </div>
  );
}
