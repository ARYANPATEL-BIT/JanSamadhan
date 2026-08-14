"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Breadcrumbs } from "@/components/gov/breadcrumbs";
import { SidebarNav } from "@/components/gov/sidebar-nav";

export default function TrackSearchPage() {
  const t = useTranslations("track");
  const tn = useTranslations("nav");
  const router = useRouter();
  const [reportId, setReportId] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = reportId.trim();
    if (!trimmed) {
      setError(t("searchEmpty"));
      return;
    }
    setError("");
    router.push(`/track/${trimmed}`);
  }

  return (
    <>
      <Breadcrumbs
        items={[
          { label: tn("home"), href: "/" },
          { label: t("breadcrumbTrack") },
        ]}
      />
      <div className="gov-container gov-interior">
        <SidebarNav />
        <div className="gov-interior__main">
          <h1 style={{ marginBottom: "8px" }}>{t("searchTitle")}</h1>
          <p style={{ color: "var(--text-muted)", marginBottom: "24px", fontSize: "14px" }}>
            {t("searchDescription")}
          </p>

          <div className="track-search">
            <form onSubmit={handleSubmit}>
              <div className="track-search__input">
                <input
                  type="text"
                  value={reportId}
                  onChange={(e) => setReportId(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  aria-label={t("searchPlaceholder")}
                  id="track-search-input"
                />
                <button type="submit" className="gov-btn gov-btn--primary">
                  {t("searchBtn")}
                </button>
              </div>
              {error && (
                <p style={{ color: "var(--gov-maroon)", fontSize: "13px", marginTop: "6px" }}>
                  {error}
                </p>
              )}
            </form>

            <div style={{ marginTop: "24px", padding: "16px", border: "1px solid var(--gov-border)", background: "var(--surface-alt)" }}>
              <p style={{ fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}>
                {t("myReportsPrompt")}
              </p>
              <Link href="/track/my" className="gov-btn gov-btn--secondary gov-btn--sm">
                {t("myReportsBtn")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
