import { expect, test } from "@playwright/test";

/**
 * Security response headers (A-042). Every route — public pages, API and
 * static files alike — must carry HSTS, a frame-ancestors CSP, X-Frame-Options
 * DENY, nosniff, a Referrer-Policy and a locked-down Permissions-Policy, and
 * must NOT advertise the framework via x-powered-by. These apply in `next dev`
 * too, so they hold against the dev server CI runs.
 */

const SECURITY_HEADERS: Record<string, string> = {
  "strict-transport-security": "max-age=63072000",
  "x-frame-options": "DENY",
  "content-security-policy": "frame-ancestors 'none'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), browsing-topics=()",
};

// Routes of different kinds: a page, the auth page, an API route and a static
// public file. Headers are checked before the filesystem, so all are covered.
const PATHS = ["/", "/login", "/api/health", "/robots.txt"];

for (const path of PATHS) {
  test(`${path} carries every security header and hides x-powered-by`, async ({ page }) => {
    const response = await page.request.get(path);
    const headers = response.headers();

    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      expect(headers[key], `${path} → ${key}`).toBe(value);
    }

    // Framework/version must not be advertised (poweredByHeader: false).
    expect(headers["x-powered-by"], `${path} → x-powered-by`).toBeUndefined();

    // HSTS must NOT yet carry includeSubDomains/preload (owner-gated, A-013).
    expect(headers["strict-transport-security"]).not.toContain("includeSubDomains");
    expect(headers["strict-transport-security"]).not.toContain("preload");
  });
}
