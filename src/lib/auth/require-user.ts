import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { PATH_HEADER } from "@/lib/auth/path-header";
import { safeNextPath } from "@/lib/auth/safe-next";
import { hadSessionCookie } from "@/lib/auth/session-cookie";
import { loginAgainHref } from "@/lib/auth/session-expired";
import { isAdminUser } from "@/lib/auth/roles";

/**
 * The authoritative session check. Every protected server action, route
 * handler and RSC page must call one of these — `proxy.ts` only checks
 * whether a session cookie exists, which is not a security boundary.
 *
 * Wrapped in React cache(): the /app layout, the page and its
 * generateMetadata each ask within one render, and each ask was a session
 * lookup. The cache lives for one server request (render or action), so a
 * sign-out or a revoked session is still seen by the next one.
 */

/**
 * better-auth's own read, from its 5-minute cookie cache: it rewrites that
 * cookie as it goes and renews the session (90 days from the last use).
 */
const getCachedSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

/**
 * The same session read from the database, past the cookie cache, without
 * writing a cookie (disableRefresh; getCachedSession keeps the cookie and the
 * renewal). A cookie written in a server action re-renders the page, which the
 * moderation panel avoids mid-tap. One indexed query.
 */
const getLiveSession = cache(async () => {
  return auth.api.getSession({ headers: await headers(), query: { disableCookieCache: true, disableRefresh: true } });
});

/**
 * Who is signed in, as the database has them now (the role included), or
 * null. The cookie cache alone vouches for a session for up to 5 minutes
 * after it ended: a ban (moderateReport ends the account's sessions), a
 * sign-out on another device, an account deleted, a role taken away
 * (requireAdmin). A banned account is refused even with a session left
 * (lib/social/authorization's rule).
 *
 * The one answer for everyone who asks: the checks below, /login, the public
 * pages and the route handlers. With /login trusting the cache while the app's
 * pages read the database, an ended session went from one to the other and
 * back (a redirect loop) until the cache ran out.
 */
export const getCurrentSession = cache(async () => {
  if (!(await getCachedSession())) return null;
  const live = await getLiveSession();
  return live && live.user.banned !== true ? live : null;
});

/**
 * Redirects to /login if there is no session. Use in RSC pages. The login
 * page comes back here afterwards, and says "your session expired" when the
 * browser still held a session cookie that no longer works.
 */
export async function requireUser() {
  const session = await getCurrentSession();
  if (!session) {
    const h = await headers();
    const here = h.get(PATH_HEADER) ?? refererPath(h.get("referer"));
    if (await hadSessionCookie()) redirect(loginAgainHref(here));
    const next = safeNextPath(here);
    redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }
  return session.user;
}

/** The path of a same-site Referer (server actions re-render the page they came from). */
function refererPath(referer: string | null): string | null {
  if (!referer) return null;
  try {
    const url = new URL(referer);
    return url.pathname + url.search;
  } catch {
    return null;
  }
}

/** Throws instead of redirecting. Use in server actions and route handlers. */
export async function requireUserOrThrow() {
  const session = await getCurrentSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session.user;
}

/**
 * Admin gate for content curation and moderation routes (section 29). Trusts
 * the `admin` plugin's `role` field OR the ADMIN_EMAILS allowlist (roles.ts
 * isAdminUser), so the very first admin can be granted without a DB write.
 * The role is the database's (getCurrentSession): one taken away stops working
 * on the next request, not when the cookie cache runs out.
 */
export async function requireAdmin() {
  const user = await requireUser();
  if (!isAdminUser(user)) {
    redirect("/app/today");
  }
  return user;
}

export async function requireAdminOrThrow() {
  const user = await requireUserOrThrow();
  if (!isAdminUser(user)) {
    throw new Error("FORBIDDEN");
  }
  return user;
}
