/**
 * The workout routes accept requests from this site only. A request without an
 * Origin header (same-origin GET/HEAD, older browsers) passes; an unparseable
 * or opaque one ("null") does not.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}
