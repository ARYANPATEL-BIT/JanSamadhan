import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { Toaster } from "@/components/ui/sonner";
import { NavAuth } from "@/components/nav-auth";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/feed" className="font-semibold tracking-tight">
            🛠️ CivicReport
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/feed" className="rounded-md px-3 py-1.5 hover:bg-muted">
              Feed
            </Link>
            <Link
              href="/report/new"
              className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground hover:opacity-90"
            >
              Report an issue
            </Link>
            <NavAuth user={user} />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      <Toaster richColors position="top-center" />
    </div>
  );
}
