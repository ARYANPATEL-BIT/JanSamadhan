// Supported locales for JanSamadhan. Mirrors the `lang` pgEnum in
// lib/db/schema.ts and the OTP-verify body schema — keep the three in sync.
export const locales = ["en", "hi", "bn", "mr", "ta", "te"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/** Endonyms (each language's own name), for the language switcher. */
export const localeNames: Record<Locale, string> = {
  en: "English",
  hi: "हिन्दी",
  bn: "বাংলা",
  mr: "मराठी",
  ta: "தமிழ்",
  te: "తెలుగు",
};

/** Cookie the locale is persisted in. Read in i18n/request.ts. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}
