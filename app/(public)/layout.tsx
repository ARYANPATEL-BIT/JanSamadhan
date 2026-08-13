import { getCurrentUser } from "@/lib/auth/session";
import { Toaster } from "@/components/ui/sonner";
import { UtilityStrip } from "@/components/gov/utility-strip";
import { Masthead } from "@/components/gov/masthead";
import { PrimaryNav } from "@/components/gov/primary-nav";
import { GovFooter } from "@/components/gov/footer";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <>
      {/* Skip to content — visible only on keyboard focus */}
      <a href="#main-content" className="gov-skip-link">
        Skip to Main Content
      </a>

      {/* GIGW Shell */}
      <UtilityStrip />
      <Masthead />
      <PrimaryNav user={user} />

      {/* Main content area */}
      <main id="main-content" style={{ flex: 1 }}>
        {children}
      </main>

      <GovFooter />
      <Toaster richColors position="top-center" />
    </>
  );
}
