import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it("accepts app and public-profile paths", () => {
    expect(safeNextPath("/app/programs/abc")).toBe("/app/programs/abc");
    expect(safeNextPath("/u/ana")).toBe("/u/ana");
    expect(safeNextPath("/app/history?month=3")).toBe("/app/history?month=3");
  });

  it("rejects anything that could leave the site or isn't an app page", () => {
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "/login", "/", "", undefined, "/apple", "javascript:alert(1)"]) {
      expect(safeNextPath(bad)).toBeNull();
    }
  });
});
