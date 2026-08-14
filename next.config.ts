import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  serverExternalPackages: ["cloudinary"],
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

// Points at ./i18n/request.ts by default.
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
