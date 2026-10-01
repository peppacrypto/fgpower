import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("allows `limit` hits per window per key, then says when to come back", () => {
    const rl = createRateLimiter({ limit: 2, windowMs: 60_000 });
    expect(rl.hit("u1", 0)).toEqual({ ok: true });
    expect(rl.hit("u1", 1000)).toEqual({ ok: true });
    expect(rl.hit("u1", 2000)).toEqual({ ok: false, retryAfterSeconds: 58 });
    // Another key has its own budget.
    expect(rl.hit("u2", 2000)).toEqual({ ok: true });
    // The first hit leaves the window.
    expect(rl.hit("u1", 60_001)).toEqual({ ok: true });
  });

  it("caps the number of keys it remembers", () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 60_000, maxKeys: 2 });
    rl.hit("a", 0);
    rl.hit("b", 0);
    rl.hit("c", 0); // evicts "a"
    expect(rl.hit("a", 1)).toEqual({ ok: true });
    expect(rl.hit("c", 1).ok).toBe(false);
  });
});
