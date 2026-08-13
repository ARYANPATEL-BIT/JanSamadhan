import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { categoryEnum } from "@/lib/db/schema";
import { CaptureFlow } from "@/components/capture-flow";

export default async function NewReportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-4 text-lg font-semibold">Report an issue</h1>
      <CaptureFlow categories={categoryEnum.enumValues} />
    </div>
  );
}
