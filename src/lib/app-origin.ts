/**
 * The app's absolute origin, for anything read outside the page that made
 * it: e-mail and push links, OG/story image URLs, public /t and /u links,
 * metadataBase. A valid NEXT_PUBLIC_APP_URL wins; otherwise production is
 * https://fgpower.monster and development the local dev server — never
 * built from request headers (a spoofed Host must not end up in an e-mail).
 * NEXT_PUBLIC_ is inlined at build time, so this also works in the browser.
 */
export const PRODUCTION_ORIGIN = "https://fgpower.monster";
export const DEV_ORIGIN = "http://localhost:3108";

export function appOrigin(): string {
  const configured = originOf(process.env.NEXT_PUBLIC_APP_URL);
  if (configured) return configured;
  return process.env.NODE_ENV === "production" ? PRODUCTION_ORIGIN : DEV_ORIGIN;
}

/** An absolute URL on the app for a path ("/t/abc" → "https://fgpower.monster/t/abc"). */
export function appUrl(path: string): string {
  return new URL(path, `${appOrigin()}/`).toString();
}

function originOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.host ? url.origin : null;
  } catch {
    return null;
  }
}
