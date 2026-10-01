import { afterEach, describe, expect, it, vi } from "vitest";
import { signLink, verifyLink } from "./signed";

afterEach(() => vi.unstubAllEnvs());

describe("signed links", () => {
  it("round-trips its data for its own purpose", () => {
    vi.stubEnv("LINK_SIGNING_SECRET", "s3cret");
    const token = signLink("click", { u: "user1", d: "del1", to: "/app/today" });
    expect(verifyLink("click", token)).toEqual({ u: "user1", d: "del1", to: "/app/today" });
    expect(verifyLink("unsub", signLink("unsub", { u: "user1" }))).toEqual({ u: "user1" });
  });

  it("refuses a swapped purpose, a tampered body or signature, another key and junk", () => {
    vi.stubEnv("LINK_SIGNING_SECRET", "s3cret");
    const token = signLink("click", { u: "user1", to: "/app/today" });
    expect(verifyLink("unsub", token)).toBeNull();
    const [body, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ u: "user2", to: "/app/today" })).toString("base64url");
    expect(verifyLink("click", `${forged}.${sig}`)).toBeNull();
    expect(verifyLink("click", `${body}.${sig.slice(0, -2)}AA`)).toBeNull();
    for (const junk of ["", ".", "abc", "a.b.c", "%%%.***", `${body}.`, null, undefined, "x".repeat(2000)]) {
      expect(verifyLink("click", junk)).toBeNull();
    }
    vi.stubEnv("LINK_SIGNING_SECRET", "other");
    expect(verifyLink("click", token)).toBeNull();
  });

  it("falls back to BETTER_AUTH_SECRET", () => {
    vi.stubEnv("LINK_SIGNING_SECRET", "");
    vi.stubEnv("BETTER_AUTH_SECRET", "auth-secret");
    const token = signLink("unsub", { u: "u" });
    expect(verifyLink("unsub", token)).toEqual({ u: "u" });
    vi.stubEnv("LINK_SIGNING_SECRET", "now-set");
    expect(verifyLink("unsub", token)).toBeNull();
  });
});
