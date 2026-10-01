/**
 * Where to send someone after signing in, from a `?next=` value. Only
 * same-site app paths are accepted — anything else (other hosts, `//host`,
 * backslash tricks, non-app pages) falls back to Today, so the parameter can't
 * be used as an open redirect. The onboarding wizard counts as an app page: a
 * session that expires mid-wizard signs in again and comes back to it; so do
 * a public profile (/u) and a shared workout (/t) someone signed up from.
 */
export function safeNextPath(next: string | string[] | undefined | null): string | null {
  const value = Array.isArray(next) ? next[0] : next;
  if (!value || value.length > 512) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  if (!/^\/(app|u|t|onboarding)(\/|$|\?)/.test(value)) return null;
  return value;
}

const isOnboarding = (path: string) => /^\/onboarding(\/|$|\?)/.test(path);

/**
 * Where the onboarding wizard ends: a safe `next` that isn't the wizard
 * itself. "/onboarding?next=/app/x" (sign-in restarted mid-wizard) unwraps to
 * "/app/x", so finishing can never loop back into the wizard.
 */
export function onboardingNextPath(next: string | string[] | undefined | null): string | null {
  const path = safeNextPath(next);
  if (!path || !isOnboarding(path)) return path;
  const query = path.indexOf("?");
  const inner = query === -1 ? null : new URLSearchParams(path.slice(query + 1)).get("next");
  const unwrapped = safeNextPath(inner);
  return unwrapped && !isOnboarding(unwrapped) ? unwrapped : null;
}
