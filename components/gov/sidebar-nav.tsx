"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const SIDEBAR_LINKS = [
  { href: "/report/new", key: "registerComplaint" },
  { href: "/track", key: "trackComplaint" },
  { href: "/feed", key: "publicReports" },
  { href: "/departments", key: "departments" },
  { href: "/civic-score", key: "civicScore" },
  { href: "/contact", key: "contactUs" },
] as const;

export function SidebarNav() {
  const t = useTranslations("nav");
  const tf = useTranslations("footer");
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <aside className="gov-sidebar" aria-label="Section navigation">
      <div className="gov-sidebar__header">{tf("quickLinks")}</div>
      <ul className="gov-sidebar__list">
        {SIDEBAR_LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className={`gov-sidebar__link${isActive(link.href) ? " gov-sidebar__link--active" : ""}`}
            >
              {t(link.key)}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
