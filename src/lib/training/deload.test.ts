import { describe, expect, it } from "vitest";
import { effectiveDeload, isAppliedDeload } from "./deload";

describe("effectiveDeload", () => {
  const monday = 20_725;

  it("is the program's planned deload", () => {
    expect(effectiveDeload(true, [], monday)).toBe(true);
    expect(effectiveDeload(true, null, monday)).toBe(true);
  });

  it("is a week the user applied a deload to", () => {
    expect(isAppliedDeload([monday - 7, monday], monday)).toBe(true);
    expect(effectiveDeload(false, [monday], monday)).toBe(true);
    expect(effectiveDeload(undefined, [monday], monday)).toBe(true);
  });

  it("is neither otherwise (another applied week doesn't count)", () => {
    expect(effectiveDeload(false, [monday - 7], monday)).toBe(false);
    expect(effectiveDeload(null, undefined, monday)).toBe(false);
    expect(isAppliedDeload(undefined, monday)).toBe(false);
  });
});
