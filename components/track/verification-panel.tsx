"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

interface VerificationPanelProps {
  reportId: string;
  beforeUrl: string | null;
  afterUrl: string | null;
  pendingSince: string | null; // ISO timestamp when PENDING_CITIZEN_VERIFICATION was entered
}

const VERIFICATION_WINDOW_DAYS = 7;

function computeDeadline(pendingSince: string | null) {
  if (!pendingSince) return { deadline: null, daysLeft: 0, hoursLeft: 0 };
  const pendingMs = new Date(pendingSince).getTime();
  const deadlineMs = pendingMs + VERIFICATION_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const diffMs = deadlineMs - Date.now();
  const daysLeft = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const hoursLeft = Math.max(0, Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
  return { deadline: new Date(deadlineMs).toISOString(), daysLeft, hoursLeft };
}

export function VerificationPanel({
  reportId,
  beforeUrl,
  afterUrl,
  pendingSince,
}: VerificationPanelProps) {
  const t = useTranslations("track");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(4);
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"confirm" | "reopen" | null>(null);
  const [deadlineInfo, setDeadlineInfo] = useState(() => computeDeadline(pendingSince));

  useEffect(() => {
    const interval = setInterval(() => {
      setDeadlineInfo(computeDeadline(pendingSince));
    }, 60_000);
    return () => clearInterval(interval);
  }, [pendingSince]);

  async function send(verdict: "CONFIRM" | "REOPEN") {
    if (verdict === "REOPEN" && reason.trim().length < 8) {
      toast.error(t("reopenReasonTooShort"));
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
      toast.success(
        verdict === "CONFIRM" ? t("confirmSuccess") : t("reopenSuccess"),
      );
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="verification-panel">
      <div className="verification-panel__header">
        {t("verifyTitle")}
      </div>
      <div className="verification-panel__body">
        {/* Countdown */}
        <div className="verification-panel__countdown">
          ⏳ {t("verifyCountdown", {
            days: deadlineInfo.daysLeft,
            hours: deadlineInfo.hoursLeft,
          })}
          <br />
          <span style={{ fontSize: "12px", fontWeight: 400 }}>
            {t("verifyAutoResolveWarning")}
          </span>
        </div>

        <p style={{ fontSize: "14px", marginBottom: "12px" }}>
          {t("verifyDescription")}
        </p>

        {/* Before / After photos */}
        {(beforeUrl || afterUrl) && (
          <div className="verification-panel__photos">
            {beforeUrl && (
              <div className="verification-panel__photo">
                <div className="verification-panel__photo-label">
                  {t("photoBefore")}
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={beforeUrl} alt={t("photoBefore")} />
              </div>
            )}
            {afterUrl && (
              <div className="verification-panel__photo">
                <div className="verification-panel__photo-label">
                  {t("photoAfter")}
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={afterUrl} alt={t("photoAfter")} />
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        {!mode && (
          <div className="verification-panel__actions">
            <button
              type="button"
              className="gov-btn gov-btn--primary"
              onClick={() => setMode("confirm")}
              disabled={busy}
            >
              ✓ {t("confirmBtn")}
            </button>
            <button
              type="button"
              className="gov-btn gov-btn--secondary"
              onClick={() => setMode("reopen")}
              disabled={busy}
              style={{ borderColor: "var(--gov-maroon)", color: "var(--gov-maroon)" }}
            >
              ↻ {t("reopenBtn")}
            </button>
          </div>
        )}

        {/* Confirm flow */}
        {mode === "confirm" && (
          <div style={{ marginTop: "12px" }}>
            <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}>
              {t("ratingLabel")}
            </label>
            <div className="verification-panel__rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={n <= rating ? "active" : ""}
                  onClick={() => setRating(n)}
                >
                  {n <= rating ? "★" : "☆"}
                </button>
              ))}
            </div>
            <div className="verification-panel__actions">
              <button
                type="button"
                className="gov-btn gov-btn--primary"
                disabled={busy}
                onClick={() => send("CONFIRM")}
              >
                {busy ? t("submitting") : t("submitConfirm")}
              </button>
              <button
                type="button"
                className="gov-btn gov-btn--secondary"
                disabled={busy}
                onClick={() => setMode(null)}
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        )}

        {/* Reopen flow */}
        {mode === "reopen" && (
          <div style={{ marginTop: "12px" }}>
            <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "6px" }}>
              {t("reopenReasonLabel")}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder={t("reopenReasonPlaceholder")}
              style={{
                display: "block",
                width: "100%",
                padding: "8px",
                border: "1px solid var(--gov-border)",
                fontSize: "14px",
                marginBottom: "12px",
              }}
            />
            <div className="verification-panel__actions">
              <button
                type="button"
                className="gov-btn gov-btn--primary"
                disabled={busy}
                onClick={() => send("REOPEN")}
                style={{ background: "var(--gov-maroon)", borderColor: "var(--gov-maroon)" }}
              >
                {busy ? t("submitting") : t("submitReopen")}
              </button>
              <button
                type="button"
                className="gov-btn gov-btn--secondary"
                disabled={busy}
                onClick={() => setMode(null)}
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
