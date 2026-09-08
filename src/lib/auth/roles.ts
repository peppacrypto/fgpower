/** Client-safe admin check (no DB/env access) — mirrors requireAdmin's rule for `role`. */
export function isAdminUser(user: { role?: string | null }) {
  return user.role === "admin";
}
