import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { publicProfileOrigin, RESERVED_USERNAMES, USERNAME_MAX, usernameCandidate } from "@/lib/validation/username";

export async function getProfile(userId: string) {
  return prisma.profile.findUnique({ where: { userId } });
}

export async function hasCompletedOnboarding(userId: string) {
  const profile = await getProfile(userId);
  return Boolean(profile?.onboardingCompletedAt);
}

/**
 * The user's public handle, read from the DB. Don't use the session user for
 * this: better-auth's session cookie cache can serve a handle up to 5 minutes
 * old, so a just-claimed username would look unsaved.
 */
export async function getPublicHandle(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true, displayUsername: true },
  });
  return user?.displayUsername ?? user?.username ?? null;
}

/**
 * Own identity for Perfil / Settings, from the DB (not the cached session):
 * `username` is the normalized handle used in URLs, `handle` the casing the
 * user chose, `name` what other people see (display name, else account name).
 */
export async function getOwnIdentity(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, image: true, username: true, displayUsername: true, profile: { select: { displayName: true } } },
  });
  if (!user) return null;
  return {
    name: user.profile?.displayName?.trim() || user.name,
    image: user.image,
    username: user.username,
    handle: user.displayUsername ?? user.username,
  };
}

/**
 * Origin for the public-profile links shown to the user themselves (Settings,
 * onboarding): the host this request came in on, so a copied link opens
 * wherever the app is actually served; NEXT_PUBLIC_APP_URL (then
 * fgpower.monster) when the host can't be read.
 */
export async function getPublicProfileOrigin(): Promise<string> {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim();
  if (!/^[a-z0-9.-]+(:\d{1,5})?$/i.test(host)) return publicProfileOrigin();
  const forwarded = h.get("x-forwarded-proto")?.split(",")[0].trim();
  const local = /^(localhost|127\.0\.0\.1)(:|$)/.test(host);
  const proto = forwarded === "http" || forwarded === "https" ? forwarded : local ? "http" : "https";
  return `${proto}://${host}`;
}

/**
 * The first free handle for `base` ("maria", "maria2", "maria3"…), skipping
 * reserved names and handles held by anyone but `userId`. `base` must already
 * be well-formed (see slugifyUsername). The write can still lose a race — the
 * unique index is the real guard, so callers retry on P2002.
 */
export async function findAvailableUsername(base: string, userId: string): Promise<string> {
  // Every candidate up to 4 suffix digits shares this prefix.
  const prefix = base.slice(0, USERNAME_MAX - 4);
  const taken = await prisma.user.findMany({
    where: { username: { startsWith: prefix }, NOT: { id: userId } },
    select: { username: true },
  });
  const used = new Set(taken.map((u) => u.username));
  for (let n = 1; n < 10_000; n++) {
    const candidate = usernameCandidate(base, n);
    if (!used.has(candidate) && !RESERVED_USERNAMES.has(candidate)) return candidate;
  }
  return usernameCandidate(base, 10_000 + Math.floor(Math.random() * 89_999));
}

/** Whether `username` (normalized) is held by someone other than `userId`. */
export async function isUsernameTaken(username: string, userId: string) {
  const existing = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  return Boolean(existing && existing.id !== userId);
}
