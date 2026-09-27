import "server-only";
import { headers } from "next/headers";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Whether this request arrived with a session cookie, even one that no longer
 * resolves to a session (signed out on another device, or expired on the
 * server). Pair with a null session to tell "your session ended" from "never
 * signed in".
 *
 * Reads the request's own Cookie header on purpose: when a server action finds
 * the session gone, better-auth deletes the cookie and Next re-renders the page
 * with `cookies()` already reflecting that deletion — `headers()` still shows
 * what the browser sent.
 */
export async function hadSessionCookie(): Promise<boolean> {
  return Boolean(getSessionCookie(await headers()));
}
