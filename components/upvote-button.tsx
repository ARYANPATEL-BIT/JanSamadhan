"use client";

import { useState } from "react";
import { toast } from "sonner";

export function UpvoteButton({
  reportId,
  initialCount,
  initialUpvoted,
  authed,
}: {
  reportId: string;
  initialCount: number;
  initialUpvoted: boolean;
  authed: boolean;
}) {
  const [count, setCount] = useState(initialCount);
  const [upvoted, setUpvoted] = useState(initialUpvoted);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!authed) {
      toast.error("Log in to upvote.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/reports/${reportId}/upvote`, { method: "POST" });
      const data = (await res.json().catch(() => null)) as
        | { upvoted?: boolean; count?: number; error?: string }
        | null;
      if (!res.ok) {
        throw new Error(data?.error === "unauthorized" ? "Log in to upvote." : "Upvote failed.");
      }
      setUpvoted(Boolean(data?.upvoted));
      setCount(Number(data?.count) || 0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upvote failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-pressed={upvoted}
      className={upvoted ? "gov-btn gov-btn--primary" : "gov-btn gov-btn--secondary"}
    >
      ▲ <span style={{ fontVariantNumeric: "tabular-nums" }}>{count}</span>{" "}
      {upvoted ? "Upvoted" : "Upvote"}
    </button>
  );
}
