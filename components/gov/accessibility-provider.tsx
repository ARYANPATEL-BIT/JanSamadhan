"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

type FontSize = "small" | "normal" | "large";

interface AccessibilityContextValue {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  highContrast: boolean;
  toggleHighContrast: () => void;
}

const FONT_SCALE: Record<FontSize, number> = {
  small: 0.875,
  normal: 1,
  large: 1.125,
};

const LS_FONT_SIZE = "gov_font_size";
const LS_HIGH_CONTRAST = "gov_high_contrast";

const AccessibilityContext = createContext<AccessibilityContextValue>({
  fontSize: "normal",
  setFontSize: () => {},
  highContrast: false,
  toggleHighContrast: () => {},
});

export function useAccessibility() {
  return useContext(AccessibilityContext);
}

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [fontSize, setFontSizeState] = useState<FontSize>("normal");
  const [highContrast, setHighContrast] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Read from localStorage on mount
  useEffect(() => {
    try {
      const savedSize = localStorage.getItem(LS_FONT_SIZE) as FontSize | null;
      if (savedSize && savedSize in FONT_SCALE) {
        setFontSizeState(savedSize);
        document.documentElement.style.setProperty(
          "--gov-font-scale",
          String(FONT_SCALE[savedSize])
        );
      }

      const savedContrast = localStorage.getItem(LS_HIGH_CONTRAST);
      if (savedContrast === "true") {
        setHighContrast(true);
        document.documentElement.classList.add("high-contrast");
      }
    } catch {
      // localStorage unavailable
    }
    setMounted(true);
  }, []);

  const setFontSize = useCallback((size: FontSize) => {
    setFontSizeState(size);
    document.documentElement.style.setProperty(
      "--gov-font-scale",
      String(FONT_SCALE[size])
    );
    try {
      localStorage.setItem(LS_FONT_SIZE, size);
    } catch {
      // localStorage unavailable
    }
  }, []);

  const toggleHighContrast = useCallback(() => {
    setHighContrast((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add("high-contrast");
      } else {
        document.documentElement.classList.remove("high-contrast");
      }
      try {
        localStorage.setItem(LS_HIGH_CONTRAST, String(next));
      } catch {
        // localStorage unavailable
      }
      return next;
    });
  }, []);

  // Prevent flash of unstyled content
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <AccessibilityContext.Provider
      value={{ fontSize, setFontSize, highContrast, toggleHighContrast }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}
