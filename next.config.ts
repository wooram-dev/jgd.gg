import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir:
    process.env.NODE_ENV === "test" && process.env.E2E_AUTH_MODE === "mock-discord"
      ? ".next-e2e"
      : ".next",
  allowedDevOrigins: ["127.0.0.1"],
  // Keep Korean public URLs while avoiding dev-server Unicode filesystem route mismatches.
  rewrites() {
    return [
      { source: encodeURI("/내정보"), destination: "/me" },
      { source: encodeURI("/멤버"), destination: "/members" },
    ];
  },
  redirects() {
    return [
      { source: "/me", destination: encodeURI("/내정보"), permanent: true },
      { source: "/members", destination: encodeURI("/멤버"), permanent: true },
    ];
  },
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
