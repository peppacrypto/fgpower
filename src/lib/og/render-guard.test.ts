import { beforeEach, describe, expect, it } from "vitest";
import { allowRender, cachedImage, clientIp, rememberImage, resetRenderGuard } from "./render-guard";

describe("render guard", () => {
  beforeEach(() => resetRenderGuard());

  it("keeps the 50 most recently used images", () => {
    for (let i = 0; i < 60; i++) rememberImage(`k${i}`, Buffer.from([i]));
    expect(cachedImage("k0")).toBeNull();
    expect(cachedImage("k10")?.[0]).toBe(10);
    // k10 was just used: it survives the next insert, k11 doesn't.
    rememberImage("k60", Buffer.from([60]));
    expect(cachedImage("k10")).not.toBeNull();
    expect(cachedImage("k11")).toBeNull();
  });

  it("limits renders per IP per minute", () => {
    const t = 1_000_000;
    for (let i = 0; i < 12; i++) expect(allowRender("1.1.1.1", t + i)).toBe(true);
    expect(allowRender("1.1.1.1", t + 20)).toBe(false);
    expect(allowRender("2.2.2.2", t + 20)).toBe(true);
    expect(allowRender("1.1.1.1", t + 61_000)).toBe(true);
  });

  it("reads the forwarded client IP", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientIp(new Headers({ "x-real-ip": "203.0.113.8" }))).toBe("203.0.113.8");
    expect(clientIp(new Headers())).toBe("local");
  });
});
