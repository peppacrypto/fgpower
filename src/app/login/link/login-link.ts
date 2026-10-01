import { safeNextPath } from "@/lib/auth/safe-next";

/**
 * The sign-in e-mail's link (lib/email/templates/login-code): its fragment
 * holds the address, the 6-digit code and where to go next —
 * `#e=ana%40gmail.com&c=482913&next=%2Fapp%2Fprograms`. Pure and
 * client-safe: the tap-to-confirm page reads it, the login form reuses the
 * address check.
 */

/** A plausible address: what the form accepts before the server's own check. */
export function isEmailAddress(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value);
}

export interface LoginLink {
  email: string;
  otp: string;
  /** A safe app path (safeNextPath), or null for Today. */
  next: string | null;
}

/** The link's fragment ("#e=…&c=…"), or null when it isn't a whole, valid one. */
export function parseLoginLinkHash(hash: string): LoginLink | null {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const email = params.get("e")?.trim().toLowerCase() ?? "";
  const otp = params.get("c")?.trim() ?? "";
  if (!isEmailAddress(email) || !/^\d{6}$/.test(otp)) return null;
  return { email, otp, next: safeNextPath(params.get("next")) };
}

/** Just the address from a fragment, even when the code is missing (to offer a new link). */
export function emailFromLoginLinkHash(hash: string): string | null {
  const email = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash).get("e")?.trim().toLowerCase() ?? "";
  return isEmailAddress(email) ? email : null;
}

/** "ana.souza@gmail.com" → "a•••@gmail.com": enough to recognise, not to read over a shoulder. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return email;
  return `${email[0]}•••${email.slice(at)}`;
}

/** "/login?email=…&next=…" — the login form, filled in, to ask for a new link. */
export function newLinkHref(email: string | null, next: string | null): string {
  const params = new URLSearchParams();
  if (email) params.set("email", email);
  if (next) params.set("next", next);
  const query = params.toString();
  return query ? `/login?${query}` : "/login";
}

/** Where a successful sign-in goes: the wizard for a new account, straight to `next` for an onboarded one. */
export function afterSignInHref(next: string | null): string {
  return `/onboarding?next=${encodeURIComponent(next ?? "/app/today")}`;
}
