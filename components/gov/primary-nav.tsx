"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SessionUser } from "@/lib/auth/session";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/report/new", label: "Register Complaint" },
  { href: "/track", label: "Track Status" },
  { href: "/feed", label: "Public Reports" },
  { href: "/departments", label: "Departments" },
  { href: "/civic-score", label: "Civic Score" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function PrimaryNav({ user }: { user: SessionUser | null }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
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
          ☰ Menu
        </button>
        <ul
          id="primary-nav-list"
          className={`gov-nav__list${mobileOpen ? " open" : ""}`}
          role="menubar"
        >
          {NAV_ITEMS.map((item) => (
            <li key={item.href} className="gov-nav__item" role="none">
              <Link
                href={item.href}
                className={`gov-nav__link${isActive(item.href) ? " gov-nav__link--active" : ""}`}
                role="menuitem"
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            </li>
          ))}

          {/* Auth section — pushed to the right */}
          <li className="gov-nav__auth" role="none">
            {user ? (
              <>
                <span className="gov-nav__auth-info">
                  Civic Score: <span className="gov-nav__auth-score">{user.civicScore}</span>
                </span>
                <span className="gov-nav__auth-info" style={{ opacity: 0.7 }}>
                  {user.phone}
                </span>
                <button
                  onClick={logout}
                  className="gov-nav__link"
                  style={{ background: "transparent", border: "none", cursor: "pointer" }}
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="gov-nav__link"
                onClick={() => setMobileOpen(false)}
              >
                Login
              </Link>
            )}
          </li>
        </ul>
      </div>
    </nav>
  );
}
