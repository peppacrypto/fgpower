/**
 * An in-process sliding-window limit (decision D-K: prod runs one web
 * replica, so memory is enough). Keys are forgotten once their window is
 * empty, and the map is capped so a flood of keys can't grow it for ever.
 */
export function createRateLimiter({ limit, windowMs, maxKeys = 5000 }: { limit: number; windowMs: number; maxKeys?: number }) {
  const hits = new Map<string, number[]>();

  return {
    /** Counts a hit for `key`: allowed, or how long until the next one is. */
    hit(key: string, now: number = Date.now()): { ok: true } | { ok: false; retryAfterSeconds: number } {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)) };
      }
      recent.push(now);
      hits.delete(key); // re-inserted last: the oldest keys are evicted first
      hits.set(key, recent);
      if (hits.size > maxKeys) {
        const oldest = hits.keys().next().value;
        if (oldest !== undefined) hits.delete(oldest);
      }
      return { ok: true };
    },
  };
}
