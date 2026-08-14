"use client";

import { useTranslations } from "next-intl";
import { useAccessibility } from "./accessibility-provider";
import { LanguageSwitcher } from "./language-switcher";

export function UtilityStrip() {
  const t = useTranslations();
  const { fontSize, setFontSize, highContrast, toggleHighContrast } =
    useAccessibility();

  return (
    <div className="gov-utility-strip" role="banner">
      <div className="gov-container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "4px" }}>
        {/* Left: Government identity */}
        <span>{t("utility.govOfIndia")}</span>

        {/* Right: Accessibility controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "2px", flexWrap: "wrap" }}>
          <a href="#main-content" className="gov-skip-link">
            {t("common.skipToContent")}
          </a>
          <a href="#main-content" style={{ padding: "0 6px" }}>{t("common.skipToContent")}</a>
          <span style={{ opacity: 0.4 }}>|</span>
          <a href="/accessibility" style={{ padding: "0 6px" }}>{t("utility.screenReader")}</a>
          <span style={{ opacity: 0.4 }}>|</span>

          {/* Font size controls */}
          <button
            onClick={() => setFontSize("small")}
            className={fontSize === "small" ? "active" : ""}
            title={t("utility.fontDecrease")}
            aria-label={t("utility.fontDecrease")}
          >
            A-
          </button>
          <button
            onClick={() => setFontSize("normal")}
            className={fontSize === "normal" ? "active" : ""}
            title={t("utility.fontDefault")}
            aria-label={t("utility.fontDefault")}
          >
            A
          </button>
          <button
            onClick={() => setFontSize("large")}
            className={fontSize === "large" ? "active" : ""}
            title={t("utility.fontIncrease")}
            aria-label={t("utility.fontIncrease")}
          >
            A+
          </button>
          <span style={{ opacity: 0.4 }}>|</span>

          {/* High contrast toggle */}
          <button
            onClick={toggleHighContrast}
            className={highContrast ? "active" : ""}
            title={highContrast ? t("utility.contrastDisableTitle") : t("utility.contrastEnableTitle")}
            aria-label={t("utility.contrastToggleAria")}
            aria-pressed={highContrast}
          >
            {highContrast ? t("utility.standardView") : t("utility.highContrast")}
          </button>
          <span style={{ opacity: 0.4 }}>|</span>

          {/* Language switcher (cookie-backed, all 6 locales) */}
          <LanguageSwitcher />
        </div>
      </div>
    </div>
  );
}
