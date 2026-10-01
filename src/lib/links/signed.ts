import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed links for actions that need no sign-in: a reminder's tracked tap
 * (/r/<token>) and the digest's unsubscribe (/email/cancelar?t=…). The token
 * is base64url(JSON) + "." + base64url(HMAC-SHA256), keyed by a key derived
 * from LINK_SIGNING_SECRET (else BETTER_AUTH_SECRET) and bound to its
 * purpose, so a click token never unsubscribes and vice versa. No expiry:
 * an unsubscribe link must still work months later. Nothing secret rides in
 * it (ids and an app path), and it only ever does what its purpose allows.
 */

export type LinkPurpose = "click" | "unsub";

export interface LinkData {
  /** The user it acts for. */
  u: string;
  /** The ReminderDelivery it belongs to (tracked taps). */
  d?: string;
  /** Where a tap goes on to (an app path; checked again with safeNextPath on use). */
  to?: string;
}

const DEV_SECRET = "fgpower-dev-link-secret";

function signingKey(): Buffer {
  const secret = process.env.LINK_SIGNING_SECRET?.trim() || process.env.BETTER_AUTH_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") throw new Error("LINK_SIGNING_SECRET or BETTER_AUTH_SECRET must be set");
    return createHmac("sha256", DEV_SECRET).update("fgpower-links-v1").digest();
  }
  return createHmac("sha256", secret).update("fgpower-links-v1").digest();
}

function mac(purpose: LinkPurpose, body: string): Buffer {
  return createHmac("sha256", signingKey()).update(`${purpose}.${body}`).digest();
}

export function signLink(purpose: LinkPurpose, data: LinkData): string {
  const clean: LinkData = { u: data.u, ...(data.d ? { d: data.d } : {}), ...(data.to ? { to: data.to } : {}) };
  const body = Buffer.from(JSON.stringify(clean), "utf8").toString("base64url");
  return `${body}.${mac(purpose, body).toString("base64url")}`;
}

export function verifyLink(purpose: LinkPurpose, token: string | null | undefined): LinkData | null {
  if (!token || token.length > 1024) return null;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot !== token.lastIndexOf(".")) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!/^[A-Za-z0-9_-]+$/.test(body) || !/^[A-Za-z0-9_-]+$/.test(sig)) return null;
  const expected = mac(purpose, body);
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, unknown>;
    if (typeof data.u !== "string" || !data.u) return null;
    return {
      u: data.u,
      ...(typeof data.d === "string" && data.d ? { d: data.d } : {}),
      ...(typeof data.to === "string" && data.to ? { to: data.to } : {}),
    };
  } catch {
    return null;
  }
}
