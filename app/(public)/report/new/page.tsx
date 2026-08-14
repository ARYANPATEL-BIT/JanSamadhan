import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/session";
import { categoryEnum } from "@/lib/db/schema";
import { CaptureFlow } from "@/components/capture-flow";
import { Breadcrumbs } from "@/components/gov/breadcrumbs";
import { SidebarNav } from "@/components/gov/sidebar-nav";

export default async function NewReportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const t = await getTranslations("reportNew");
  const tn = await getTranslations("nav");

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
          <div className="gov-notice gov-notice--info" style={{ marginBottom: "16px" }}>
            <strong>{t("instructionsLabel")}</strong> {t("instructionsText")}
          </div>
          <div style={{ maxWidth: "480px" }}>
            <CaptureFlow categories={categoryEnum.enumValues} />
          </div>
        </div>
      </div>
    </>
  );
}
