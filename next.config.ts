import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse uses synchronous require() of binaries - cannot be bundled by webpack
  serverExternalPackages: ["pdf-parse"],

  experimental: {
    serverActions: {
      // Next.js default is 1MB - too low for ESG PDF reports
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
