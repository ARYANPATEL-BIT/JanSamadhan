"use client";

import { useAccessibility } from "./accessibility-provider";

export function UtilityStrip() {
  const { fontSize, setFontSize, highContrast, toggleHighContrast } =
    useAccessibility();

  return (
    <div className="gov-utility-strip" role="banner">
      <div className="gov-container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "4px" }}>
        {/* Left: Government identity */}
        <span>भारत सरकार | Government of India</span>

        {/* Right: Accessibility controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "2px", flexWrap: "wrap" }}>
          <a href="#main-content" className="gov-skip-link">
            Skip to Main Content
          </a>
          <a href="#main-content" style={{ padding: "0 6px" }}>Skip to Main Content</a>
          <span style={{ opacity: 0.4 }}>|</span>
          <a href="/accessibility" style={{ padding: "0 6px" }}>Screen Reader Access</a>
          <span style={{ opacity: 0.4 }}>|</span>

          {/* Font size controls */}
          <button
            onClick={() => setFontSize("small")}
            className={fontSize === "small" ? "active" : ""}
            title="Decrease font size"
            aria-label="Decrease font size"
          >
            A-
          </button>
          <button
            onClick={() => setFontSize("normal")}
            className={fontSize === "normal" ? "active" : ""}
            title="Default font size"
            aria-label="Default font size"
          >
            A
          </button>
          <button
            onClick={() => setFontSize("large")}
            className={fontSize === "large" ? "active" : ""}
            title="Increase font size"
            aria-label="Increase font size"
          >
            A+
          </button>
          <span style={{ opacity: 0.4 }}>|</span>

          {/* High contrast toggle */}
          <button
            onClick={toggleHighContrast}
            className={highContrast ? "active" : ""}
            title={highContrast ? "Standard contrast" : "High contrast"}
            aria-label="Toggle high contrast mode"
            aria-pressed={highContrast}
          >
            {highContrast ? "Standard View" : "High Contrast"}
          </button>
          <span style={{ opacity: 0.4 }}>|</span>

          {/* Language toggle */}
          <a href="?lang=en" style={{ padding: "0 6px" }}>English</a>
          <span style={{ opacity: 0.4 }}>|</span>
          <a href="?lang=hi" style={{ padding: "0 6px" }}>हिन्दी</a>
        </div>
      </div>
    </div>
  );
}
