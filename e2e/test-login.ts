// Dev/test-only helper: mints a real, correctly-signed better-auth session
// for a fixed test account. NEVER usable in production (auth.ts disables
// emailAndPassword outside development/test). Used by manual smoke checks
// and Playwright global setup.
import "dotenv/config";
import { auth } from "../src/lib/auth/auth";

export async function createTestSession(email = "e2e@fgpower.dev", name = "E2E Test") {
  const password = "e2e-test-password-not-real-123!";

  let res = await auth.api.signInEmail({ body: { email, password }, asResponse: true }).catch(() => null);
  if (!res || !res.ok) {
    res = await auth.api.signUpEmail({ body: { email, password, name }, asResponse: true });
  }
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) throw new Error("No set-cookie header returned");
  const match = setCookie.match(/better-auth\.session_token=([^;]+)/);
  if (!match) throw new Error(`Could not find session cookie in: ${setCookie}`);
  return decodeURIComponent(match[1]);
}

if (require.main === module) {
  createTestSession().then((token) => {
    console.log(token);
    process.exit(0);
  });
}
