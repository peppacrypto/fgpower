import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Never advertise the framework in responses: Next adds `x-powered-by:
  // Next.js` by default (A-042). Defense in depth — it leaks the stack to
  // anyone probing the site.
  poweredByHeader: false,
  // Hard ceiling on the request body the Node proxy buffers in memory (A-045).
  // The default is 10 MB; now that the proxy matches /api, that would let an
  // anonymous client make the single replica buffer ~10 MB per request even
  // though the /api cap (src/proxy.ts MAX_API_BODY_BYTES = 256 KB) rejects it.
  // 1 MB matches serverActions.bodySizeLimit (Next's 1 MB default), so a
  // legitimate /app server-action body is not truncated, while /api still 413s
  // at 256 KB first. The body is still drained up to this ceiling, never beyond.
  experimental: {
    proxyClientMaxBodySize: "1mb",
  },
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
  // Canonical host: anyone who reaches us on www.fgpower.monster is sent to
  // the apex with a 308 (method/body preserving), keeping the path and query.
  // Requires `www` to be attached as a custom domain on the Railway web
  // service — otherwise the request hits Railway's *.up.railway.app fallback
  // (cert mismatch + "Application not found") and this redirect never runs.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.fgpower.monster" }],
        destination: "https://fgpower.monster/:path*",
        permanent: true,
      },
    ];
  },
  // Site-wide security response headers (A-042). `/:path*` matches every path
  // including `/`; Next checks headers before the filesystem, so `/public`
  // files and route handlers are covered too. These are defense in depth: the
  // session cookie is already HttpOnly + SameSite=Lax + Secure.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            // Force HTTPS for 2 years. `includeSubDomains`/`preload` are
            // OWNER-GATED: add them only once `www.fgpower.monster` is a
            // custom domain on the Railway web service (A-013 residue) and
            // every subdomain is known-HTTPS — otherwise a plain-HTTP
            // subdomain is locked out of browsers for 2 years.
            key: "Strict-Transport-Security",
            value: "max-age=63072000",
          },
          {
            // Clickjacking: no one may frame the app (legacy header).
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            // `frame-ancestors`-only CSP: supersedes X-Frame-Options in modern
            // browsers and introduces no script-src, so the inline theme boot
            // script (src/lib/theme.ts) still runs. A full nonce/hash CSP is a
            // follow-up (see A-042 residue).
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            // The app uses no camera/mic/geolocation/topics — deny them all.
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
