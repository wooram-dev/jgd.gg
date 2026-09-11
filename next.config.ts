import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir:
    process.env.NODE_ENV === "test" && process.env.E2E_AUTH_MODE === "mock-discord"
      ? ".next-e2e"
      : ".next",
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.discordapp.com",
      },
    ],
  },
  poweredByHeader: false,
};

export default nextConfig;
