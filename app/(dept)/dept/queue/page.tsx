import { redirect } from "next/navigation";
import { getDeptActor } from "@/lib/auth/dept";
import { listDeptQueue } from "@/lib/services/dept";
import { Breadcrumbs } from "@/components/gov/breadcrumbs";
import { DeptQueueTable } from "@/components/dept/queue-table";

export const dynamic = "force-dynamic";

export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; slaBreached?: string }>;
}) {
  const actor = await getDeptActor();
  if (!actor) redirect("/login?portal=dept&next=/dept/queue");
  if (actor.role !== "DEPT_ADMIN") redirect("/dept/tasks");

  const sp = await searchParams;
  const items = await listDeptQueue(actor.departmentId, "main", {
    status: sp.status,
    slaBreached: sp.slaBreached === "1",
  });

  return (
    <div className="gov-container" style={{ padding: "20px 16px 40px" }}>
      <Breadcrumbs items={[{ label: "Department Portal" }, { label: "Work Queue" }]} />
      <h1 style={{ margin: "12px 0" }}>Department Work Queue</h1>
      <p style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "12px" }}>
        Ranked by priority. Flagged items also appear under Manual Review.
      </p>
      <form method="get" style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
        <select name="status" defaultValue={sp.status ?? ""} className="gov-select" style={{ padding: "6px 8px" }}>
          <option value="">All statuses</option>
          {["SUBMITTED", "ASSIGNED", "IN_PROGRESS", "PENDING_CITIZEN_VERIFICATION", "REOPENED"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <label style={{ fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
          <input type="checkbox" name="slaBreached" value="1" defaultChecked={sp.slaBreached === "1"} />
          SLA breached
        </label>
        <button type="submit" className="gov-btn gov-btn--secondary gov-btn--sm">Filter</button>
      </form>
      {items.length === 0 ? (
        <div className="gov-notice gov-notice--info">No reports in the main queue.</div>
      ) : (
        <DeptQueueTable rows={items} />
      )}
    </div>
  );
}
