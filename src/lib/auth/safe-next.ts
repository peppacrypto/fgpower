/**
 * Where to send someone after signing in, from a `?next=` value. Only
 * same-site app paths are accepted — anything else (other hosts, `//host`,
 * backslash tricks, non-app pages) falls back to Today, so the parameter can't
 * be used as an open redirect.
 */
export function safeNextPath(next: string | string[] | undefined | null): string | null {
  const value = Array.isArray(next) ? next[0] : next;
  if (!value || value.length > 512) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  if (!/^\/(app|u)(\/|$|\?)/.test(value)) return null;
  return value;
}
