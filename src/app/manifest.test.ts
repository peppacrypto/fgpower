import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("PWA manifest (A-032)", () => {
  const m = manifest();

  it("does not lock the installed app to portrait (WCAG 1.3.4)", () => {
    expect(m.orientation).not.toBe("portrait-primary");
    // "any" or an absent field both satisfy the requirement.
    expect([undefined, "any"]).toContain(m.orientation);
  });

  it("still installs standalone with its identity and icons", () => {
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/app/today");
    expect(m.icons?.length).toBeGreaterThan(0);
  });
});
