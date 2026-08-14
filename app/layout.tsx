import type { Metadata } from "next";
import {
  Noto_Sans,
  Noto_Sans_Devanagari,
  Noto_Sans_Bengali,
  Noto_Sans_Tamil,
  Noto_Sans_Telugu,
} from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { AccessibilityProvider } from "@/components/gov/accessibility-provider";
import "./globals.css";

const notoSans = Noto_Sans({
  variable: "--font-noto-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const notoSansDevanagari = Noto_Sans_Devanagari({
  variable: "--font-noto-sans-devanagari",
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const notoSansBengali = Noto_Sans_Bengali({
  variable: "--font-noto-sans-bengali",
  subsets: ["bengali"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const notoSansTamil = Noto_Sans_Tamil({
  variable: "--font-noto-sans-tamil",
  subsets: ["tamil"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const notoSansTelugu = Noto_Sans_Telugu({
  variable: "--font-noto-sans-telugu",
  subsets: ["telugu"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "JanSamadhan — Civic Grievance Redressal Portal",
  description:
    "Official civic grievance registration and tracking portal of JanSamadhan. Register complaints about civic issues, track resolution status, and view public reports.",
  keywords: "grievance, civic complaint, municipal corporation, pothole, garbage, streetlight, waterlogging",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Locale is resolved from the NEXT_LOCALE cookie (see i18n/request.ts). The
  // matching NextIntlClientProvider makes messages available to Client
  // Components without re-serialising them per subtree.
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      id="top"
      className={`${notoSans.variable} ${notoSansDevanagari.variable} ${notoSansBengali.variable} ${notoSansTamil.variable} ${notoSansTelugu.variable}`}
    >
      <body>
        <NextIntlClientProvider>
          <AccessibilityProvider>
            {children}
          </AccessibilityProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
