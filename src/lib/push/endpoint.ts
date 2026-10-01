import * as z from "zod";

/**
 * A push subscription comes from the browser, and the server later POSTs to
 * its endpoint: without a check that is a server-side request to any URL a
 * user types (SSRF). Only the real push services are accepted — https, port
 * 443, no credentials, a known host — with keys of the right shape. Pure.
 */

const EXACT_HOSTS = new Set(["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"]);
/** Host suffixes of push services with regional or numbered hosts. */
const HOST_SUFFIXES = [".push.services.mozilla.com", ".push.apple.com", ".notify.windows.com"];

export const MAX_ENDPOINT_LENGTH = 2048;

export function isAllowedPushEndpoint(endpoint: string): boolean {
  if (typeof endpoint !== "string" || endpoint.length > MAX_ENDPOINT_LENGTH) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || (url.port !== "" && url.port !== "443")) return false;
  if (url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  return EXACT_HOSTS.has(host) || HOST_SUFFIXES.some((suffix) => host.endsWith(suffix) && host.length > suffix.length);
}

const base64url = (min: number, max: number) =>
  z
    .string()
    .min(min)
    .max(max)
    .regex(/^[A-Za-z0-9_-]+={0,2}$/);

/** What PushSubscription.toJSON() gives, as the subscribe route accepts it. */
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().max(MAX_ENDPOINT_LENGTH).refine(isAllowedPushEndpoint, "endpoint not allowed"),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    // A 65-byte P-256 point: 87 characters (88 padded).
    p256dh: base64url(80, 100),
    // 16 bytes: 22 characters (24 padded).
    auth: base64url(16, 32),
  }),
});

export type PushSubscriptionJSON = z.infer<typeof pushSubscriptionSchema>;
