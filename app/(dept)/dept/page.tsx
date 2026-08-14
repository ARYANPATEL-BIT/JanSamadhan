import { getDeptActor } from "@/lib/auth/dept";
import { redirect } from "next/navigation";
import QueuePage from "./queue/page";
import TasksPage from "./tasks/page";

export const dynamic = "force-dynamic";

export default async function DeptIndex({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; slaBreached?: string }>;
}) {
  const actor = await getDeptActor();
  if (!actor) redirect("/login?portal=dept");
  if (actor.role === "FIELD_STAFF") return <TasksPage />;
  return <QueuePage searchParams={searchParams} />;
}
