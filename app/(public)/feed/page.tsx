import { getCurrentUser } from "@/lib/auth/session";
import { listFeed } from "@/lib/services/reports";
import { FeedView } from "@/components/feed-view";
import { Breadcrumbs } from "@/components/gov/breadcrumbs";
import { SidebarNav } from "@/components/gov/sidebar-nav";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const user = await getCurrentUser();
  const items = await listFeed(user?.id ?? null);

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Public Grievance Reports" },
        ]}
      />
      <div className="gov-container gov-interior">
        <SidebarNav />
        <div className="gov-interior__main">
          <h1 style={{ marginBottom: "12px" }}>Public Grievance Reports</h1>
          {items.length === 0 ? (
            <div className="gov-notice gov-notice--info">
              No grievance reports have been registered yet. Be the first citizen to report a civic issue.
            </div>
          ) : (
            <FeedView items={items} authed={!!user} />
          )}
        </div>
      </div>
    </>
  );
}
