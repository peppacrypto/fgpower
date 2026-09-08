import type { Page } from "@playwright/test";

/**
 * Logs the browser context in as a fixed E2E test account via the dev-only
 * /api/test/login route (see src/app/api/test/login/route.ts). This never
 * exists in production — better-auth's emailAndPassword provider is
 * disabled there, and the route itself 404s.
 */
export async function loginAsTestUser(page: Page, email = "e2e@fgpower.dev") {
  const response = await page.request.post("/api/test/login", { data: { email, name: "E2E Test" } });
  if (!response.ok()) {
    throw new Error(`Test login failed: ${response.status()} ${await response.text()}`);
  }
}
