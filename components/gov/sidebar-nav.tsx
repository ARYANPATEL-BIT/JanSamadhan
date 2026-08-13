"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SIDEBAR_LINKS = [
  { href: "/report/new", label: "Register Complaint" },
  { href: "/track", label: "Track Complaint" },
  { href: "/feed", label: "Public Reports" },
  { href: "/departments", label: "Departments" },
  { href: "/civic-score", label: "Civic Score" },
  { href: "/contact", label: "Contact Us" },
];

export function SidebarNav() {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <aside className="gov-sidebar" aria-label="Section navigation">
      <div className="gov-sidebar__header">Quick Links</div>
      <ul className="gov-sidebar__list">
        {SIDEBAR_LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className={`gov-sidebar__link${isActive(link.href) ? " gov-sidebar__link--active" : ""}`}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
