import { describe, expect, it } from "vitest";
import { onboardingNextPath, safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it("accepts app, public-profile, shared-workout and onboarding paths", () => {
    expect(safeNextPath("/app/programs/abc")).toBe("/app/programs/abc");
    expect(safeNextPath("/u/ana")).toBe("/u/ana");
    expect(safeNextPath("/t/AbCdEfGhIj_-0123")).toBe("/t/AbCdEfGhIj_-0123");
    expect(safeNextPath("/t/x?y")).toBe("/t/x?y");
    expect(safeNextPath("/app/history?month=3")).toBe("/app/history?month=3");
    expect(safeNextPath("/onboarding")).toBe("/onboarding");
    expect(safeNextPath("/onboarding?next=%2Fapp%2Fx&passo=4")).toBe("/onboarding?next=%2Fapp%2Fx&passo=4");
  });

  it("rejects anything that could leave the site or isn't an app page", () => {
    for (const bad of [
      "https://evil.com",
      "//evil.com",
      "/\\evil.com",
      "/login",
      "/",
      "",
      undefined,
      "/apple",
      "/onboardingx",
      "/tx",
      "//t",
      "/t\\evil.com",
      "javascript:alert(1)",
    ]) {
      expect(safeNextPath(bad)).toBeNull();
    }
  });
});

describe("onboardingNextPath", () => {
  it("passes app paths through", () => {
    expect(onboardingNextPath("/app/programs/templates/gd-1")).toBe("/app/programs/templates/gd-1");
    expect(onboardingNextPath("/u/ana")).toBe("/u/ana");
    expect(onboardingNextPath("/t/AbCdEfGhIj_-0123")).toBe("/t/AbCdEfGhIj_-0123");
  });

  it("unwraps a sign-in that restarted mid-wizard, and never points back at the wizard", () => {
    expect(onboardingNextPath("/onboarding?next=%2Fapp%2Fprograms%2Ftemplates%2Fgd-1&passo=4")).toBe(
      "/app/programs/templates/gd-1",
    );
    expect(onboardingNextPath("/onboarding")).toBeNull();
    expect(onboardingNextPath("/onboarding?passo=2")).toBeNull();
    expect(onboardingNextPath(`/onboarding?next=${encodeURIComponent("/onboarding?next=/app/x")}`)).toBeNull();
    expect(onboardingNextPath("/onboarding?next=%2F%2Fevil.com")).toBeNull();
    expect(onboardingNextPath("//evil.com")).toBeNull();
  });
});
