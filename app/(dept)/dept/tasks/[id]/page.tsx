import { notFound, redirect } from "next/navigation";
import { getDeptActor } from "@/lib/auth/dept";
import { getDeptReport } from "@/lib/services/dept";
import { Breadcrumbs } from "@/components/gov/breadcrumbs";
import { categoryLabel } from "@/lib/categories";
import { slaLabel, slaState } from "@/components/dept/queue-table";
import { PinMap } from "@/components/dept/pin-map";
import { WorkPhotoCapture } from "@/components/dept/work-photo-capture";

export const dynamic = "force-dynamic";

function statusClass(status: string): string {
  return `gov-status gov-status--${status.toLowerCase()}`;
}

export default async function FieldTaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await getDeptActor();
  if (!actor) redirect("/login?portal=dept&next=/dept/tasks");
  if (actor.role !== "FIELD_STAFF") redirect(`/dept/reports/${(await params).id}`);

  const { id } = await params;
  const report = await getDeptReport(id);
  if (!report) notFound();
  if (report.department_id !== actor.departmentId || report.assignee_id !== actor.user.id) {
    notFound();
  }

  const lng = Number(report.lng);
  const lat = Number(report.lat);
  const sla = slaState(report.created_at, report.sla_due_at);
  const citizen = report.media.filter((m) => m.kind === "REPORT" || m.kind === "CORROBORATING");
  const hasBefore = report.media.some((m) => m.kind === "BEFORE");
  const hasAfter = report.media.some((m) => m.kind === "AFTER");

  return (
    <div className="gov-container" style={{ padding: "20px 16px 40px" }}>
      <Breadcrumbs
        items={[
          { label: "My Tasks", href: "/dept/tasks" },
          { label: `#${id.slice(0, 8).toUpperCase()}` },
        ]}
      />
      <h1 style={{ margin: "12px 0" }}>
        Task — {categoryLabel(report.category)}
      </h1>
      <p>
        <span className={statusClass(report.status)}>{report.status}</span>{" "}
        <span className={sla === "over" || sla === "warn" ? "gov-badge gov-badge--danger" : "gov-badge"}>
          {slaLabel(report.sla_due_at)}
        </span>
      </p>
      {report.description ? <p style={{ marginTop: "8px" }}>{report.description}</p> : null}

      {citizen.map((m) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={m.id}
          src={m.url}
          alt="Citizen report"
          style={{ width: "100%", maxHeight: "320px", objectFit: "cover", marginTop: "12px", border: "1px solid var(--gov-border)" }}
        />
      ))}

      <div style={{ marginTop: "16px" }}>
        <PinMap lng={lng} lat={lat} />
      </div>
      <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "6px" }}>
        Work photos must be taken within 50 m of this pin.
      </p>

      <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "1fr 1fr", marginTop: "16px" }}>
        <div>
          <strong>Before</strong>
          {report.media.filter((m) => m.kind === "BEFORE").map((m) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={m.id} src={m.url} alt="Before" style={{ width: "100%", marginTop: "8px" }} />
          ))}
        </div>
        <div>
          <strong>After</strong>
          {report.media.filter((m) => m.kind === "AFTER").map((m) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={m.id} src={m.url} alt="After" style={{ width: "100%", marginTop: "8px" }} />
          ))}
        </div>
      </div>

      {report.status === "REOPENED" ? (
        <div className="gov-notice gov-notice--info" style={{ marginTop: "16px" }}>
          This ticket was reopened. Wait for the department admin to reassign it, then capture a new before photo.
        </div>
      ) : null}
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
      {report.status === "IN_PROGRESS" && hasBefore && hasAfter && (
        <div className="gov-notice gov-notice--info" style={{ marginTop: "16px" }}>
          Latest photos are on file. Department admin can close the ticket.
        </div>
      )}
    </div>
  );
}
