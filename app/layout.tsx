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
  weight: ["400", "600", "700"],
  display: "swap",
});

const notoSansDevanagari = Noto_Sans_Devanagari({
  variable: "--font-noto-devanagari",
  subsets: ["devanagari"],
  weight: ["400", "600", "700"],
  display: "swap",
  preload: false,
});

const notoSansBengali = Noto_Sans_Bengali({
  variable: "--font-noto-bengali",
  subsets: ["bengali"],
  weight: ["400", "600", "700"],
  display: "swap",
  preload: false,
});

const notoSansTamil = Noto_Sans_Tamil({
  variable: "--font-noto-tamil",
  subsets: ["tamil"],
  weight: ["400", "600", "700"],
  display: "swap",
  preload: false,
});

const notoSansTelugu = Noto_Sans_Telugu({
  variable: "--font-noto-telugu",
  subsets: ["telugu"],
  weight: ["400", "600", "700"],
  display: "swap",
  preload: false,
});

function scriptFont(locale: string) {
  switch (locale) {
    case "hi":
    case "mr":
      return notoSansDevanagari;
    case "bn":
      return notoSansBengali;
    case "ta":
      return notoSansTamil;
    case "te":
      return notoSansTelugu;
    default:
      return null;
  }
}

export const metadata: Metadata = {
  title: "JanSamadhan — Civic Grievance Redressal Portal",
  description:
    "Official civic grievance registration and tracking portal of JanSamadhan. Register complaints about civic issues, track resolution status, and view public reports.",
  keywords: "grievance, civic complaint, municipal corporation, pothole, garbage, streetlight, waterlogging",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const script = scriptFont(locale);

  return (
    <html
      lang={locale}
      id="top"
      className={`${notoSans.variable}${script ? ` ${script.variable}` : ""}`}
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
