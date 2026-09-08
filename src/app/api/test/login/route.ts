import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";

/**
 * Dev/test-only session bootstrap for Playwright E2E (spec §31). Mints a
 * real, correctly-signed better-auth session for a fixed test account —
 * never usable in production, since auth.ts only enables emailAndPassword
 * outside NODE_ENV=production, and this route 404s there too.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { email = "e2e@fgpower.dev", name = "E2E Test" } = await request.json().catch(() => ({}));
  const password = "e2e-test-password-not-real-123!";

  let res = await auth.api.signInEmail({ body: { email, password }, asResponse: true }).catch(() => null);
  if (!res || !res.ok) {
    res = await auth.api.signUpEmail({ body: { email, password, name }, asResponse: true });
  }

  const setCookie = res.headers.get("set-cookie");
  const response = NextResponse.json({ ok: true });
  if (setCookie) response.headers.set("set-cookie", setCookie);
  return response;
}
