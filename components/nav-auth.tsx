"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SessionUser } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";

export function NavAuth({ user }: { user: SessionUser | null }) {
  const router = useRouter();

  if (!user) {
    return (
      <Link href="/login" className="rounded-md px-3 py-1.5 hover:bg-muted">
        Log in
      </Link>
    );
  }

  async function logout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.refresh();
    router.push("/feed");
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="secondary" title={`Tier: ${user.tier}`}>
        {user.tier} · {user.civicScore}
      </Badge>
      <span className="hidden text-muted-foreground sm:inline">{user.phone}</span>
      <button onClick={logout} className="rounded-md px-3 py-1.5 hover:bg-muted">
        Log out
      </button>
    </div>
  );
}
