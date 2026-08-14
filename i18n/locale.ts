"use server";

import { cookies } from "next/headers";
import {
  type Locale,
  LOCALE_COOKIE,
  defaultLocale,
  isLocale,
} from "./config";

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Resolve the active locale from the cookie, falling back to the default.
 * This is the single source of truth consumed by i18n/request.ts.
 */
export async function getUserLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : defaultLocale;
}

/**
 * Persist the chosen locale in a first-party cookie. Called by the language
 * switcher (as a server action) and after OTP login to honour the citizen's
 * stored language preference.
 */
export async function setUserLocale(locale: Locale): Promise<void> {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
  });
}
