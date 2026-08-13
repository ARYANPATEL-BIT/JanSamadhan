import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { categoryEnum } from "@/lib/db/schema";
import { CaptureFlow } from "@/components/capture-flow";
import { Breadcrumbs } from "@/components/gov/breadcrumbs";
import { SidebarNav } from "@/components/gov/sidebar-nav";

export default async function NewReportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Register Complaint" },
        ]}
      />
      <div className="gov-container gov-interior">
        <SidebarNav />
        <div className="gov-interior__main">
          <h1 style={{ marginBottom: "12px" }}>Register New Civic Complaint</h1>
          <div className="gov-notice gov-notice--info" style={{ marginBottom: "16px" }}>
            <strong>Instructions:</strong> Capture a photograph of the civic issue using the camera below.
            The system will automatically record your GPS location and timestamp. Gallery uploads are not
            permitted to ensure authenticity of reports.
          </div>
          <div style={{ maxWidth: "480px" }}>
            <CaptureFlow categories={categoryEnum.enumValues} />
          </div>
        </div>
      </div>
    </>
  );
}
