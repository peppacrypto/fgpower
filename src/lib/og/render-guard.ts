import "server-only";

/**
 * The story image costs ~200 ms of CPU per render on a single web replica
 * (D-K), and anyone holding a link can ask for it: renders are cached in
 * process (LRU, keyed by token + the activity's updatedAt, so an edit or a
 * new caption renders again) and limited per client IP.
 */

const MAX_ENTRIES = 50;
const cache = new Map<string, Buffer>();

export function cachedImage(key: string): Buffer | null {
  const hit = cache.get(key);
  if (!hit) return null;
  // Most recently used goes to the end.
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

export function rememberImage(key: string, png: Buffer) {
  cache.delete(key);
  cache.set(key, png);
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
}

const WINDOW_MS = 60_000;
/** Renders per IP per minute (cache hits are free). */
const PER_IP = 12;
/** Renders per minute from everyone together. */
const GLOBAL = 120;
const perIp = new Map<string, number[]>();
let global: number[] = [];

/** Whether `ip` may start one more render now (and counts it when so). */
export function allowRender(ip: string, now: number = Date.now()): boolean {
  const since = now - WINDOW_MS;
  global = global.filter((t) => t > since);
  const mine = (perIp.get(ip) ?? []).filter((t) => t > since);
  if (mine.length >= PER_IP || global.length >= GLOBAL) {
    perIp.set(ip, mine);
    return false;
  }
  mine.push(now);
  perIp.set(ip, mine);
  global.push(now);
  if (perIp.size > 5000) {
    for (const [key, times] of perIp) if (!times.some((t) => t > since)) perIp.delete(key);
  }
  return true;
}

/** The client's IP as the proxy in front of the app reports it. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "local";
}

/** For tests. */
export function resetRenderGuard() {
  cache.clear();
  perIp.clear();
  global = [];
}
