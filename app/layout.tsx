import type { Metadata } from "next";
import { Noto_Sans, Noto_Sans_Devanagari } from "next/font/google";
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

export const metadata: Metadata = {
  title: "JanSamadhan — Civic Grievance Redressal Portal | Nagarpratinidhi Municipal Corporation",
  description:
    "Official civic grievance registration and tracking portal of Nagarpratinidhi Municipal Corporation. Register complaints about civic issues, track resolution status, and view public reports.",
  keywords: "grievance, civic complaint, municipal corporation, pothole, garbage, streetlight, waterlogging",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      id="top"
      className={`${notoSans.variable} ${notoSansDevanagari.variable}`}
    >
      <body>
        <AccessibilityProvider>
          {children}
        </AccessibilityProvider>
      </body>
    </html>
  );
}
