"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { SessionUser } from "@/lib/auth/session";

const NAV_ITEMS = [
  { href: "/", key: "home" },
  { href: "/report/new", key: "registerComplaint" },
  { href: "/track", key: "trackStatus" },
  { href: "/feed", key: "publicReports" },
  { href: "/departments", key: "departments" },
  { href: "/civic-score", key: "civicScore" },
  { href: "/about", key: "about" },
  { href: "/contact", key: "contact" },
] as const;

export function PrimaryNav({ user }: { user: SessionUser | null }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = [
    ...NAV_ITEMS.slice(0, 5),
    {
      href: user?.portal === "dept" ? "/dept" : "/login?portal=dept",
      key: "departmentPortal" as const,
    },
    ...NAV_ITEMS.slice(5),
  ];

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    if (href.includes("portal=dept") || href === "/dept") return pathname.startsWith("/dept");
    return pathname.startsWith(href.split("?")[0]);
  }

  async function logout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    window.location.href = "/feed";
  }

  return (
    <nav className="gov-nav" aria-label="Primary navigation">
      <div className="gov-container" style={{ display: "flex", flexDirection: "column" }}>
        <button
          className="gov-nav__toggle"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-expanded={mobileOpen}
          aria-controls="primary-nav-list"
        >
          ☰ {t("menu")}
        </button>
        <ul
          id="primary-nav-list"
          className={`gov-nav__list${mobileOpen ? " open" : ""}`}
          role="menubar"
        >
          {items.map((item) => (
            <li key={item.href} className="gov-nav__item" role="none">
              <Link
                href={item.href}
                className={`gov-nav__link${isActive(item.href) ? " gov-nav__link--active" : ""}`}
                role="menuitem"
                onClick={() => setMobileOpen(false)}
              >
                {t(item.key)}
              </Link>
            </li>
          ))}

          {/* Auth section — pushed to the right */}
          <li className="gov-nav__auth" role="none">
            {user ? (
              <>
                <span className="gov-nav__auth-info">
                  {t("civicScoreLabel")}: <span className="gov-nav__auth-score">{user.civicScore}</span>
                </span>
                <span className="gov-nav__auth-info" style={{ opacity: 0.7 }}>
                  {user.phone}
                </span>
                <button
                  onClick={logout}
                  className="gov-nav__link"
                  style={{ background: "transparent", border: "none", cursor: "pointer" }}
                >
                  {t("logout")}
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="gov-nav__link"
                onClick={() => setMobileOpen(false)}
              >
                {t("login")}
              </Link>
            )}
          </li>
        </ul>
      </div>
    </nav>
  );
}
