import Link from "next/link";
import { categoryLabel } from "@/lib/categories";

export function slaState(createdAt: string, slaDueAt: string | null): "none" | "ok" | "warn" | "over" {
  if (!slaDueAt) return "none";
  const created = new Date(createdAt).getTime();
  const due = new Date(slaDueAt).getTime();
  const now = Date.now();
  if (now >= due) return "over";
  const window = Math.max(due - created, 1);
  const used = (now - created) / window;
  return used >= 0.8 ? "warn" : "ok";
}

export function slaLabel(slaDueAt: string | null): string {
  if (!slaDueAt) return "—";
  const due = new Date(slaDueAt).getTime();
  const hrs = Math.round((due - Date.now()) / 3600000);
  if (hrs < 0) return `${Math.abs(hrs)}h overdue`;
  if (hrs < 24) return `${hrs}h left`;
  return `${Math.round(hrs / 24)}d left`;
}

function statusClass(status: string): string {
  return `gov-status gov-status--${status.toLowerCase()}`;
}

export interface QueueRow {
  id: string;
  category: string;
  status: string;
  upvoteCount: number;
  createdAt: string;
  slaDueAt: string | null;
  wardNo: number | null;
  thumbnailUrl: string | null;
  assigneeName: string | null;
  reopenCount: number;
}

export function DeptQueueTable({ rows }: { rows: QueueRow[] }) {
  return (
    <table className="gov-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Photo</th>
          <th>Category</th>
          <th>Ward</th>
          <th>Age</th>
          <th>SLA</th>
          <th>Upvotes</th>
          <th>Status</th>
          <th>Assignee</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const sla = slaState(r.createdAt, r.slaDueAt);
          const ageH = Math.max(0, Math.round((Date.now() - new Date(r.createdAt).getTime()) / 3600000));
          return (
            <tr key={r.id} style={r.reopenCount >= 2 ? { background: "#fdecea" } : undefined}>
              <td>
                <Link href={`/dept/reports/${r.id}`} style={{ fontFamily: "monospace" }}>
                  {r.id.slice(0, 8).toUpperCase()}
                  {r.reopenCount >= 2 ? " · REOPEN×" + r.reopenCount : ""}
                </Link>
              </td>
              <td>
                {r.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.thumbnailUrl} alt="" width={48} height={48} style={{ objectFit: "cover", border: "1px solid var(--gov-border)" }} />
                ) : (
                  "—"
                )}
              </td>
              <td>{categoryLabel(r.category)}</td>
              <td>{r.wardNo != null ? `Ward ${r.wardNo}` : "—"}</td>
              <td>{ageH < 24 ? `${ageH}h` : `${Math.round(ageH / 24)}d`}</td>
              <td>
                <span
                  className={
                    sla === "over"
                      ? "gov-badge gov-badge--danger"
                      : sla === "warn"
                        ? "gov-badge gov-badge--warning"
                        : "gov-badge"
                  }
                >
                  {slaLabel(r.slaDueAt)}
                </span>
              </td>
              <td>{r.upvoteCount}</td>
              <td>
                <span className={statusClass(r.status)}>{r.status}</span>
              </td>
              <td>{r.assigneeName ?? "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
