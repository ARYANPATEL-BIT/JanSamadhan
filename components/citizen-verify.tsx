"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function CitizenVerify({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(4);
  const [reason, setReason] = useState("");

  async function send(verdict: "CONFIRM" | "REOPEN") {
    if (verdict === "REOPEN" && reason.trim().length < 8) {
      toast.error("Please describe why the work is incomplete.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/reports/${reportId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verdict,
          rating: verdict === "CONFIRM" ? rating : undefined,
          reason: verdict === "REOPEN" ? reason : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed");
      toast.success(verdict === "CONFIRM" ? "Thank you — marked resolved" : "Reopened for the department");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gov-card" style={{ marginBottom: "16px" }}>
      <div className="gov-card__header">Verify this resolution</div>
      <div className="gov-card__body">
        <p style={{ fontSize: "14px", marginBottom: "12px" }}>
          The department submitted before/after proof. Confirm if the issue is fixed, or reopen it.
        </p>
        <label style={{ display: "block", fontSize: "14px", marginBottom: "12px" }}>
          Rating
          <select
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
            style={{ marginLeft: "8px", padding: "4px 8px" }}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="gov-btn gov-btn--primary"
          disabled={busy}
          onClick={() => send("CONFIRM")}
        >
          Confirm resolved
        </button>
        <label style={{ display: "block", fontSize: "14px", margin: "16px 0 8px" }}>
          Reopen reason
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            style={{ display: "block", width: "100%", marginTop: "4px", padding: "6px" }}
          />
        </label>
        <button
          type="button"
          className="gov-btn gov-btn--secondary"
          disabled={busy}
          onClick={() => send("REOPEN")}
        >
          Reopen
        </button>
      </div>
    </div>
  );
}
