import { getDeptActor } from "@/lib/auth/dept";
import { redirect } from "next/navigation";
import { Toaster } from "@/components/ui/sonner";
import { UtilityStrip } from "@/components/gov/utility-strip";
import { Masthead } from "@/components/gov/masthead";
import { GovFooter } from "@/components/gov/footer";
import { DeptChrome } from "@/components/dept/dept-chrome";

export default async function DeptLayout({ children }: { children: React.ReactNode }) {
  const actor = await getDeptActor();
  if (!actor) redirect("/login?portal=dept");

  return (
    <>
      <a href="#main-content" className="gov-skip-link">
        Skip to Main Content
      </a>
      <UtilityStrip />
      <Masthead />
      <DeptChrome role={actor.role} phone={actor.user.phone} />
      <main id="main-content" style={{ flex: 1 }}>
        {children}
      </main>
      <GovFooter />
      <Toaster richColors position="top-center" />
    </>
  );
}
