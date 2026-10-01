import type { MetadataRoute } from "next";

/**
 * Crawlers may read the public site. /t (shared workouts) and /u (profiles)
 * stay crawlable on purpose: link-preview bots (Twitterbot,
 * facebookexternalhit) honour robots.txt and would drop the previews — /t
 * keeps itself out of indexes with its own noindex.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/app/", "/api/", "/admin/", "/onboarding", "/r/", "/email/"] },
  };
}
