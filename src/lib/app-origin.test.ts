import { afterEach, describe, expect, it, vi } from "vitest";
import { appOrigin, appUrl, DEV_ORIGIN, PRODUCTION_ORIGIN } from "./app-origin";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("appOrigin", () => {
  it("uses a valid NEXT_PUBLIC_APP_URL (origin only)", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://fgpower.monster/some/path?x=1");
    expect(appOrigin()).toBe("https://fgpower.monster");
  });

  it("ignores an invalid or non-http value", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "not a url");
    expect(appOrigin()).toBe(PRODUCTION_ORIGIN);
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "javascript:alert(1)");
    expect(appOrigin()).toBe(PRODUCTION_ORIGIN);
  });

  it("falls back to the production origin in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(appOrigin()).toBe(PRODUCTION_ORIGIN);
  });

  it("falls back to the dev server outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(appOrigin()).toBe(DEV_ORIGIN);
  });
});

describe("appUrl", () => {
  it("joins a path onto the origin", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://fgpower.monster");
    expect(appUrl("/t/AbCdEfGhIjKlMnOp")).toBe("https://fgpower.monster/t/AbCdEfGhIjKlMnOp");
    expect(appUrl("/r/x?y=1")).toBe("https://fgpower.monster/r/x?y=1");
  });
});
