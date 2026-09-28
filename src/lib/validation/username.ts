import { appOrigin } from "@/lib/app-origin";

/**
 * Public-handle rules (`/u/<username>`), shared by Settings, onboarding and
 * the server actions. Plain functions, no zod, so the onboarding wizard can
 * check a handle as it's typed without pulling a schema library into the
 * client bundle.
 *
 * The SQL backfill (prisma/migrations/*_backfill_usernames) mirrors
 * `slugifyUsername` + `usernameCandidate`; keep them in step.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;

/** The rule as users read it, shown before they type. */
export const USERNAME_RULE = "3 a 24 caracteres: letras, números e _";

export const RESERVED_USERNAMES = new Set([
  "admin", "api", "app", "fgpower", "settings", "login", "logout", "onboarding",
  "programs", "exercises", "workout", "history", "progress", "profile", "feed",
  "u", "science", "privacy", "terms", "support", "help", "root", "null", "undefined",
]);

export const USERNAME_TAKEN = "Este nome de usuário já está em uso.";
export const USERNAME_UNAVAILABLE = "Este nome de usuário não está disponível.";

/** Why a handle can't be used as typed (format or reserved), or null if it can. */
export function usernameError(value: string): string | null {
  const v = value.trim();
  if (v.length < USERNAME_MIN) return "Mínimo de 3 caracteres.";
  if (v.length > USERNAME_MAX) return "Máximo de 24 caracteres.";
  if (!/^[a-zA-Z0-9_]+$/.test(v)) return "Use apenas letras, números e _ (sem espaços, acentos ou hífen).";
  if (RESERVED_USERNAMES.has(v.toLowerCase())) return USERNAME_UNAVAILABLE;
  return null;
}

/**
 * A handle derived from a display name: "Maria Luísa" → "maria_luisa". Always
 * well-formed (3–24 of [a-z0-9_]) but may be reserved or taken — resolve with
 * `usernameCandidate` against the database.
 */
export function slugifyUsername(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const base = slug.slice(0, USERNAME_MAX).replace(/_+$/, "");
  if (base === "") return "atleta";
  if (base.length < USERNAME_MIN) return `${base}_fg`;
  return base;
}

/** The n-th try for a base: n = 1 is the base itself, then "maria2", "maria3"… (always ≤ 24 chars). */
export function usernameCandidate(base: string, n: number): string {
  if (n <= 1) return base;
  const suffix = String(n);
  return base.slice(0, USERNAME_MAX - suffix.length) + suffix;
}

/**
 * Origin of public profile links (https://fgpower.monster in production): the
 * app's origin (lib/app-origin.ts), which also works in the browser.
 */
export function publicProfileOrigin(): string {
  return appOrigin();
}

/** "fgpower.monster/u/maria" — the link as people read it (no protocol). */
export function publicProfileLabel(username: string, origin = publicProfileOrigin()): string {
  return `${new URL(origin).host}/u/${username}`;
}
