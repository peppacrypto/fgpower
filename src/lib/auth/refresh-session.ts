import "server-only";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";

/**
 * Re-reads the session past better-auth's 5-minute cookie cache, which
 * rewrites that cookie (via nextCookies()). Call after changing a field the
 * session carries (username), or pages reading session.user would show the
 * old value for up to 5 minutes.
 */
export async function refreshSessionCache() {
  try {
    await auth.api.getSession({ headers: await headers(), query: { disableCookieCache: true } });
  } catch (err) {
    console.warn("session cache refresh failed", err);
  }
}
