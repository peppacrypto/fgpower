import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSha } from "./build-info";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("buildSha", () => {
  it("returns the BUILD_SHA set at deploy time", () => {
    vi.stubEnv("BUILD_SHA", "3631d91");
    expect(buildSha()).toBe("3631d91");
  });

  it("trims surrounding whitespace", () => {
    vi.stubEnv("BUILD_SHA", "  abc1234\n");
    expect(buildSha()).toBe("abc1234");
  });

  it("falls back to \"unknown\" when BUILD_SHA is unset", () => {
    vi.stubEnv("BUILD_SHA", "");
    expect(buildSha()).toBe("unknown");
  });

  it("falls back to \"unknown\" when BUILD_SHA is only whitespace", () => {
    vi.stubEnv("BUILD_SHA", "   ");
    expect(buildSha()).toBe("unknown");
  });
});
