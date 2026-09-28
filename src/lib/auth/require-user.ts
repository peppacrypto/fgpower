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
export const getCurrentSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
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
