"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { locales, localeNames, type Locale } from "@/i18n/config";
import { setUserLocale } from "@/i18n/locale";

/**
 * Cookie-backed language switcher for the GIGW utility strip. Persists the
 * choice via the setUserLocale server action, then refreshes so every Server
 * Component re-renders with the new locale's messages (no /[locale] routing).
 */
export function LanguageSwitcher() {
  const t = useTranslations("utility");
  const active = useLocale() as Locale;
  const [pending, startTransition] = useTransition();

  function onChange(next: Locale) {
    if (next === active) return;
    startTransition(async () => {
      await setUserLocale(next);
    });
  }

  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "0 6px" }}>
      <span className="sr-only">{t("language")}</span>
      <span aria-hidden="true">🌐</span>
      <select
        value={active}
        disabled={pending}
        onChange={(e) => onChange(e.target.value as Locale)}
        aria-label={t("language")}
        style={{
          background: "transparent",
          border: "none",
          color: "inherit",
          font: "inherit",
          fontFamily: "system-ui, sans-serif",
          cursor: "pointer",
        }}
      >
        {locales.map((l) => (
          <option key={l} value={l} style={{ color: "#000" }}>
            {localeNames[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
