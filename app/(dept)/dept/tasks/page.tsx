import { redirect } from "next/navigation";
import { getDeptActor } from "@/lib/auth/dept";
import { listFieldTasks } from "@/lib/services/dept";
import { Breadcrumbs } from "@/components/gov/breadcrumbs";
import { FieldTaskMap } from "@/components/dept/field-task-map";
import { slaLabel, slaState } from "@/components/dept/queue-table";
import { categoryLabel } from "@/lib/categories";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const actor = await getDeptActor();
  if (!actor) redirect("/login?portal=dept&next=/dept/tasks");
  if (actor.role !== "FIELD_STAFF") redirect("/dept/queue");

  const items = await listFieldTasks(actor);
  const mapped = items.map((r) => ({
    id: r.id,
    category: r.category,
    status: r.status,
    lng: Number(r.lng),
    lat: Number(r.lat),
    slaDueAt: r.sla_due_at,
    createdAt: r.created_at,
    wardNo: r.ward_no,
    reopenCount: Number(r.reopen_count) || 0,
  }));

  return (
    <div className="gov-container" style={{ padding: "20px 16px 40px" }}>
      <Breadcrumbs items={[{ label: "Field Portal" }, { label: "My Tasks" }]} />
      <h1 style={{ margin: "12px 0" }}>Assigned Tasks</h1>
      {mapped.length === 0 ? (
        <div className="gov-notice gov-notice--info">No open tasks assigned to you.</div>
      ) : (
        <>
          <FieldTaskMap items={mapped} />
          <table className="gov-table" style={{ marginTop: "16px" }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Category</th>
                <th>Ward</th>
                <th>SLA</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {mapped.map((r) => {
                const sla = slaState(r.createdAt, r.slaDueAt);
                return (
                  <tr key={r.id} style={r.reopenCount >= 2 ? { background: "#fdecea" } : undefined}>
                    <td style={{ fontFamily: "monospace" }}>{r.id.slice(0, 8).toUpperCase()}</td>
                    <td>{categoryLabel(r.category)}</td>
                    <td>{r.wardNo != null ? `Ward ${r.wardNo}` : "—"}</td>
                    <td>
                      <span className={sla === "over" ? "gov-badge gov-badge--danger" : sla === "warn" ? "gov-badge gov-badge--danger" : "gov-badge"}>
                        {slaLabel(r.slaDueAt)}
                      </span>
                    </td>
                    <td><span className={`gov-status gov-status--${r.status.toLowerCase()}`}>{r.status}</span></td>
                    <td>
                      <Link href={`/dept/tasks/${r.id}`} className="gov-btn gov-btn--primary gov-btn--sm">Open</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
