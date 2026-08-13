import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/session";
import { listFeed } from "@/lib/services/reports";
import { FeedView } from "@/components/feed-view";
import { Breadcrumbs } from "@/components/gov/breadcrumbs";
import { SidebarNav } from "@/components/gov/sidebar-nav";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const t = await getTranslations("feed");
  const tn = await getTranslations("nav");
  const user = await getCurrentUser();
  const items = await listFeed(user?.id ?? null);

  return (
    <>
      <Breadcrumbs
        items={[
          { label: tn("home"), href: "/" },
          { label: t("breadcrumb") },
        ]}
      />
      <div className="gov-container gov-interior">
        <SidebarNav />
        <div className="gov-interior__main">
          <h1 style={{ marginBottom: "12px" }}>{t("title")}</h1>
          {items.length === 0 ? (
            <div className="gov-notice gov-notice--info">
              {t("empty")}
            </div>
          ) : (
            <FeedView items={items} authed={!!user} />
          )}
        </div>
      </div>
    </>
  );
}
