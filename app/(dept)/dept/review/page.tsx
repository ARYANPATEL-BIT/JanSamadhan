import { redirect } from "next/navigation";
import { getDeptActor } from "@/lib/auth/dept";
import { listDeptQueue } from "@/lib/services/dept";
import { Breadcrumbs } from "@/components/gov/breadcrumbs";
import { DeptQueueTable } from "@/components/dept/queue-table";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const actor = await getDeptActor();
  if (!actor) redirect("/login?portal=dept&next=/dept/review");
  if (actor.role !== "DEPT_ADMIN") redirect("/dept/tasks");

  const items = await listDeptQueue(actor.departmentId, "review", {});

  return (
    <div className="gov-container" style={{ padding: "20px 16px 40px" }}>
      <Breadcrumbs items={[{ label: "Department Portal", href: "/dept/queue" }, { label: "Manual Review" }]} />
      <h1 style={{ margin: "12px 0" }}>Manual Review Lane</h1>
      <p style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "12px" }}>
        Low ML confidence, low-trust capture, possible duplicates, or collusion flags.
      </p>
      {items.length === 0 ? (
        <div className="gov-notice gov-notice--info">Nothing flagged for review.</div>
      ) : (
        <DeptQueueTable rows={items} />
      )}
    </div>
  );
}
