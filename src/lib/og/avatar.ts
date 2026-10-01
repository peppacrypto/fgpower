import "server-only";

/**
 * A profile photo for a share image, fetched server-side. User.image can hold
 * any URL in a row stored before better-auth's /update-user was closed (auth.ts
 * APP_AUTH_ROUTES), so this is an SSRF guard first: https on Google's avatar
 * host only (no port, no credentials, no redirects), 2 s, 1 MB, PNG or JPEG.
 * Anything else draws the initials instead, as components/ui/misc.tsx's Avatar
 * does in the browser.
 */

const AVATAR_HOST = "lh3.googleusercontent.com";
const MAX_BYTES = 1024 * 1024;
const TIMEOUT_MS = 2000;
const TYPES = new Set(["image/png", "image/jpeg"]);

/** The URL to fetch for an avatar (256 px, square crop), or null when it isn't a Google avatar. */
export function avatarFetchUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== AVATAR_HOST || url.port !== "" || url.username || url.password) return null;
  // Google sizes avatars with a "=s96-c" suffix; ask for 256 px, cropped square.
  const path = /=[^/]*$/.test(url.pathname) ? url.pathname.replace(/=[^/]*$/, "=s256-c") : `${url.pathname}=s256-c`;
  return `https://${AVATAR_HOST}${path}`;
}

export async function fetchAvatarDataUri(raw: string | null | undefined): Promise<string | null> {
  const url = avatarFetchUrl(raw);
  if (!url) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: "error", cache: "no-store" });
    if (!res.ok || !res.body) return null;
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!TYPES.has(type)) return null;
    if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) return null;
    const chunks: Uint8Array[] = [];
    let size = 0;
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    return `data:${type};base64,${Buffer.concat(chunks).toString("base64")}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
