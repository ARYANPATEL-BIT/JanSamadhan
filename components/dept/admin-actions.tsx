"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const REJECT_REASONS = [
  "not_a_civic_issue",
  "fake_or_staged_photo",
  "wrong_location",
  "spam_duplicate_abuse",
  "insufficient_evidence",
] as const;

export function AdminActions({
  reportId,
  status,
}: {
  reportId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [staff, setStaff] = useState<{ id: string; name: string | null; phone: string }[]>([]);
  const [depts, setDepts] = useState<{ id: string; name: string }[]>([]);
  const [staffId, setStaffId] = useState("");
  const [deptId, setDeptId] = useState("");
  const [rejectReason, setRejectReason] = useState<(typeof REJECT_REASONS)[number]>("not_a_civic_issue");
  const [note, setNote] = useState("");

  useEffect(() => {
    void Promise.all([
      fetch("/api/v1/dept/staff").then((r) => r.json()),
      fetch("/api/v1/dept/departments").then((r) => r.json()),
    ]).then(([s, d]) => {
      setStaff(s.staff ?? []);
      setDepts(d.items ?? []);
      if (s.staff?.[0]) setStaffId(s.staff[0].id);
      if (d.items?.[0]) setDeptId(d.items[0].id);
    });
  }, []);

  async function post(url: string, body?: unknown) {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.reason ?? data.error ?? "failed");
      toast.success("Saved");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const canTriage = status === "SUBMITTED" || status === "REOPENED" || status === "ASSIGNED" || status === "IN_PROGRESS";
  const canAssign = status === "SUBMITTED" || status === "REOPENED" || status === "ASSIGNED" || status === "IN_PROGRESS";
  const canClose = status === "IN_PROGRESS";

  return (
    <div className="gov-card" style={{ marginTop: "16px" }}>
      <div className="gov-card__header">Department actions</div>
      <div className="gov-card__body" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {canTriage && (
          <div>
            <strong style={{ display: "block", marginBottom: "8px" }}>Triage</strong>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                className="gov-btn gov-btn--primary gov-btn--sm"
                disabled={busy}
                onClick={() => post(`/api/v1/dept/reports/${reportId}/triage`, { action: "legitimate" })}
              >
                Mark legitimate
              </button>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px", alignItems: "center" }}>
              <select
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value as typeof rejectReason)}
                style={{ padding: "6px 8px" }}
              >
                {REJECT_REASONS.map((r) => (
                  <option key={r} value={r}>{r.replaceAll("_", " ")}</option>
                ))}
              </select>
              <button
                type="button"
                className="gov-btn gov-btn--secondary gov-btn--sm"
                disabled={busy}
                onClick={() =>
                  post(`/api/v1/dept/reports/${reportId}/triage`, {
                    action: "reject",
                    reason: rejectReason,
                    note: note || undefined,
                  })
                }
              >
                Reject (−40 civic)
              </button>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px", alignItems: "center" }}>
              <select value={deptId} onChange={(e) => setDeptId(e.target.value)} style={{ padding: "6px 8px" }}>
                {depts.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <button
                type="button"
                className="gov-btn gov-btn--secondary gov-btn--sm"
                disabled={busy || !deptId}
                onClick={() =>
                  post(`/api/v1/dept/reports/${reportId}/triage`, {
                    action: "wrong_department",
                    departmentId: deptId,
                    note: note || undefined,
                  })
                }
              >
                Wrong department
              </button>
            </div>
          </div>
        )}

        {canAssign && (
          <div>
            <strong style={{ display: "block", marginBottom: "8px" }}>Assign field staff</strong>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              <select value={staffId} onChange={(e) => setStaffId(e.target.value)} style={{ padding: "6px 8px" }}>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name || s.phone}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="gov-btn gov-btn--primary gov-btn--sm"
                disabled={busy || !staffId}
                onClick={() => post(`/api/v1/dept/reports/${reportId}/assign`, { staffId })}
              >
                Assign
              </button>
            </div>
          </div>
        )}

        {canClose && (
          <div>
            <strong style={{ display: "block", marginBottom: "8px" }}>Close (proof gate)</strong>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "8px" }}>
              Requires before + after photos within 50 m of the pin, captured after assignment.
            </p>
            <button
              type="button"
              className="gov-btn gov-btn--primary gov-btn--sm"
              disabled={busy}
              onClick={() => post(`/api/v1/dept/reports/${reportId}/close`)}
            >
              Submit for citizen verification
            </button>
          </div>
        )}

        <label style={{ fontSize: "14px" }}>
          Note (optional)
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            style={{ display: "block", width: "100%", marginTop: "4px", padding: "6px" }}
          />
        </label>
      </div>
    </div>
  );
}
