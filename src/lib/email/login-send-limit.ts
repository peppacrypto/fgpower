import "server-only";
import { createRateLimiter } from "@/lib/export/rate-limit";

/**
 * A per-IP (and per-address) cap on the sign-in code-send path, so an
 * anonymous client can't trigger unbounded Resend sends — cost, and keeping
 * e-mail sign-in down for everyone or locking one address out (A-043). This is
 * the code-only backstop: it does NOT depend on better-auth's own per-IP
 * rate limit, which falls back to a single shared bucket behind a multi-hop
 * proxy unless `advanced.ipAddress.trustedProxies` is configured (owner/infra).
 *
 * In process (decision D-K: prod runs one web replica, so memory is enough;
 * same basis as og/render-guard and the data-export limiter). The durable
 * per-address / global budgets (lib/email/login-code) stay as they were and
 * count real sends across restarts; these caps add the IP dimension the
 * EmailMessage log has no column for, plus a sub-minute burst guard the
 * hour/day DB windows lack.
 */

/** Sign-in codes one client IP may ask for, per minute and per rolling day. */
export const LOGIN_SENDS_PER_IP_PER_MINUTE = 5;
export const LOGIN_SENDS_PER_IP_PER_DAY = 30;
/** Sign-in codes one address may ask for per minute (the DB budget still caps 5/h, 10/day). */
export const LOGIN_SENDS_PER_ADDRESS_PER_MINUTE = 3;

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

let perIpMinute = createRateLimiter({ limit: LOGIN_SENDS_PER_IP_PER_MINUTE, windowMs: MINUTE_MS });
let perIpDay = createRateLimiter({ limit: LOGIN_SENDS_PER_IP_PER_DAY, windowMs: DAY_MS });
let perAddressMinute = createRateLimiter({ limit: LOGIN_SENDS_PER_ADDRESS_PER_MINUTE, windowMs: MINUTE_MS });

export type LoginSendVerdict = "ok" | "ip" | "address";

/**
 * The client's IP as the proxy in front of the app reports it (leftmost
 * `x-forwarded-for`, then `x-real-ip`). Mirrors og/render-guard's reader — the
 * app's convention for IP-based abuse control behind the same proxy.
 */
export function clientIp(headers: Headers | undefined): string {
  if (!headers) return "local";
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "local";
}

/**
 * Whether one more sign-in code may be sent now, counting the hit when so. The
 * per-address burst is checked FIRST so an impatient user re-requesting a code
 * for their OWN address is refused without consuming the shared per-IP budget:
 * on carrier CGNAT many real users egress one IP, and hit() counts only when it
 * allows. An email flood still needs many distinct addresses, each of which
 * passes the address check and then ticks the per-IP caps, so the
 * anonymous-abuse dimension stays protected. A verdict other than "ok" means
 * refuse with a 429.
 */
export function allowLoginCodeSend(p: { ip: string; email: string }, now: number = Date.now()): LoginSendVerdict {
  if (!perAddressMinute.hit(p.email.trim().toLowerCase(), now).ok) return "address";
  if (!perIpMinute.hit(p.ip, now).ok || !perIpDay.hit(p.ip, now).ok) return "ip";
  return "ok";
}

/** For tests. */
export function resetLoginSendLimit() {
  perIpMinute = createRateLimiter({ limit: LOGIN_SENDS_PER_IP_PER_MINUTE, windowMs: MINUTE_MS });
  perIpDay = createRateLimiter({ limit: LOGIN_SENDS_PER_IP_PER_DAY, windowMs: DAY_MS });
  perAddressMinute = createRateLimiter({ limit: LOGIN_SENDS_PER_ADDRESS_PER_MINUTE, windowMs: MINUTE_MS });
}
