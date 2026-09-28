import "server-only";

/** ADMIN_EMAILS: comma-separated addresses that are admins without a role write (the first admin). */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.trim().toLowerCase());
}

/**
 * The one admin rule — requireAdmin, the sidebar's "Admin" link, Settings'
 * "Painel admin": the admin plugin's `role`, or an address in ADMIN_EMAILS.
 * Server-only (it reads the env): pass the result to client components.
 */
export function isAdminUser(user: { role?: string | null; email?: string | null }): boolean {
  return user.role === "admin" || isAdminEmail(user.email);
}
