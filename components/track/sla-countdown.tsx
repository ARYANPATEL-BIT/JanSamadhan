"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

interface SlaCountdownProps {
  slaDueAt: string | null;
  closedAt: string | null;
  status: string;
}

function computeSla(slaDueAt: string, now: number) {
  const dueMs = new Date(slaDueAt).getTime();
  const diffMs = dueMs - now;
  const diffDays = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((Math.abs(diffMs) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return { isOverdue: diffMs < 0, days: diffDays, hours: diffHours };
}

export function SlaCountdown({ slaDueAt, closedAt, status }: SlaCountdownProps) {
  const t = useTranslations("track");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (status === "RESOLVED" || status === "REJECTED" || !slaDueAt) return;
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, [status, slaDueAt]);

  const isTerminal = status === "RESOLVED" || status === "REJECTED";

  if (isTerminal && closedAt) {
    return (
      <div className="sla-countdown sla-countdown--resolved">
        {t("slaCompleted", {
          date: new Date(closedAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
        })}
      </div>
    );
  }

  if (!slaDueAt) return null;

  const { isOverdue, days, hours } = computeSla(slaDueAt, now);

  if (isOverdue) {
    return (
      <div className="sla-countdown sla-countdown--overdue">
        {t("slaOverdue", { days })}
      </div>
    );
  }

  const isWarning = days <= 1;
  return (
    <div className={`sla-countdown ${isWarning ? "sla-countdown--warning" : "sla-countdown--on-track"}`}>
      {t("slaDueIn", { days, hours })}
    </div>
  );
}
