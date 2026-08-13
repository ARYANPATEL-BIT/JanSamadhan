import { getRequestConfig } from "next-intl/server";
import { getUserLocale } from "./locale";

// next-intl "without i18n routing" setup: the locale comes from a cookie
// (see i18n/locale.ts), not from the URL. No /[locale] route segment needed.
export default getRequestConfig(async () => {
  const locale = await getUserLocale();
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
