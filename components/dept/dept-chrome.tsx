"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { StaffRole } from "@/lib/auth/dept";

export function DeptChrome({ role, phone }: { role: StaffRole; phone: string }) {
  const pathname = usePathname();

  const items =
    role === "DEPT_ADMIN"
      ? [
          { href: "/dept/queue", label: "Work Queue" },
          { href: "/dept/review", label: "Manual Review" },
        ]
      : [{ href: "/dept/tasks", label: "My Tasks" }];

  async function logout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    window.location.href = "/login?portal=dept";
  }

  return (
    <nav className="gov-nav" aria-label="Department navigation">
      <div className="gov-container">
        <ul className="gov-nav__list" role="menubar">
          {items.map((item) => (
            <li key={item.href} className="gov-nav__item" role="none">
              <Link
                href={item.href}
                className={`gov-nav__link${pathname.startsWith(item.href) ? " gov-nav__link--active" : ""}`}
                role="menuitem"
              >
                {item.label}
              </Link>
            </li>
          ))}
          <li className="gov-nav__item" role="none">
            <Link href="/home" className="gov-nav__link" role="menuitem">
              Citizen Portal
            </Link>
          </li>
          <li className="gov-nav__auth" role="none">
            <span className="gov-nav__auth-info">
              {role === "DEPT_ADMIN" ? "Department Admin" : "Field Staff"} · {phone}
            </span>
            <button
              onClick={logout}
              className="gov-nav__link"
              style={{ background: "transparent", border: "none", cursor: "pointer" }}
            >
              Logout
            </button>
          </li>
        </ul>
      </div>
    </nav>
  );
}
