import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Deployed on Railway via Railpack (auto-detected `next start`), not a
  // Dockerfile — plain `next start --port $PORT` already respects Railway's
  // injected PORT/HOSTNAME (see package.json "start"), so we skip
  // `output: "standalone"` and its manual asset-copy requirements.
  images: {
    remotePatterns: [
      // Google account avatars (better-auth Google OAuth profile picture)
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
