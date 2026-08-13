import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { listFeed } from "@/lib/services/reports";
import { FeedView } from "@/components/feed-view";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const user = await getCurrentUser();
  const items = await listFeed(user?.id ?? null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Nearby issues</h1>
        <Link
          href="/report/new"
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
        >
          Report an issue
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No reports yet. Be the first to report an issue.
        </p>
      ) : (
        <FeedView items={items} authed={!!user} />
      )}
    </div>
  );
}
