import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";

/**
 * The authoritative session check. Every protected server action, route
 * handler and RSC page must call one of these — `proxy.ts` only checks
 * whether a session cookie exists, which is not a security boundary.
 */
export async function getCurrentSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** Redirects to /login if there is no session. Use in RSC pages. */
export async function requireUser() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }
  return session.user;
}

/** Throws instead of redirecting. Use in server actions and route handlers. */
export async function requireUserOrThrow() {
  const session = await getCurrentSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session.user;
}

function isAdminEmail(email: string) {
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}

/**
 * Admin gate for content curation routes (section 29). Trusts the
 * `admin` plugin's `role` field OR the ADMIN_EMAILS allowlist, so the very
 * first admin can be granted without a DB write.
 */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin" && !isAdminEmail(user.email)) {
    redirect("/app/today");
  }
  return user;
}

export async function requireAdminOrThrow() {
  const user = await requireUserOrThrow();
  if (user.role !== "admin" && !isAdminEmail(user.email)) {
    throw new Error("FORBIDDEN");
  }
  return user;
}
