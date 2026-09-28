/**
 * Share-link tokens (W-008): /t/<token> opens ONE workout to whoever holds the
 * link, whatever its visibility — so a token is 96 random bits (16 base64url
 * characters), minted only by an explicit owner tap, revocable, and never part
 * of another viewer's payload (lib/db.ts omits Activity.shareToken). Pure and
 * client-safe: Web Crypto exists in Node 20+ and in every browser.
 */

export const SHARE_TOKEN_LENGTH = 16;
export const SHARE_TOKEN_RE = /^[A-Za-z0-9_-]{16}$/;

const BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function isShareToken(value: unknown): value is string {
  return typeof value === "string" && SHARE_TOKEN_RE.test(value);
}

/** A fresh token: 12 random bytes as 16 base64url characters (no padding). */
export function newShareToken(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(12));
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += BASE64URL[(n >> 18) & 63] + BASE64URL[(n >> 12) & 63] + BASE64URL[(n >> 6) & 63] + BASE64URL[n & 63];
  }
  return out;
}

/** The public page of a shared workout. */
export function sharePath(token: string): string {
  return `/t/${token}`;
}

/** The story image (1080×1920) of a shared workout; `version` busts caches after an edit. */
export function storyPath(token: string, version: number | string): string {
  return `/t/${token}/story.png?v=${encodeURIComponent(String(version))}`;
}
