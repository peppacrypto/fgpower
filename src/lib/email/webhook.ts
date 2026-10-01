import { createHmac, timingSafeEqual } from "node:crypto";

/** Svix signatures (Resend webhooks) older or newer than this are refused (replays). */
const MAX_SKEW_S = 5 * 60;

/**
 * Checks a Svix-signed webhook (Resend): HMAC-SHA256 over
 * "<svix-id>.<svix-timestamp>.<raw body>" with the base64 secret after
 * "whsec_", any of the space-separated "v1,<base64>" signatures matching,
 * and a timestamp within 5 minutes.
 */
export function verifySvix(secret: string, headers: Headers, body: string, nowS = Math.floor(Date.now() / 1000)): boolean {
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatures = headers.get("svix-signature");
  if (!id || !timestamp || !signatures) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowS - ts) > MAX_SKEW_S) return false;
  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();
  return signatures.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const given = Buffer.from(sig, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
