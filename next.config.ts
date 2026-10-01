import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Deployed on Railway via Railpack (auto-detected `next start`), not a
  // Dockerfile — plain `next start --port $PORT` already respects Railway's
  // injected PORT/HOSTNAME (see package.json "start"), so we skip
  // `output: "standalone"` and its manual asset-copy requirements.
  images: {
    // Exercise images never change in place (a new image gets a new filename):
    // cache optimized variants for 30 days instead of the 4-hour default.
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      // Google account avatars (better-auth Google OAuth profile picture)
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  // Crawlers that only read <head>: they get the metadata (og:image of /t and
  // /u links) rendered up front instead of streamed. Next's default list plus
  // the link-preview bots that aren't in it.
  htmlLimitedBots:
    /[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight|TelegramBot|Signal|Iframely|Embedly|Pinterest|Bluesky|Mastodon/i,
};

export default nextConfig;
