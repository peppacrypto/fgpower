import { describe, expect, it } from "vitest";
import { estimate1Rm, estimate1RmEpley, estimate1RmBrzycki, MAX_RELIABLE_REPS_FOR_1RM } from "./estimated-1rm";

describe("estimate1RmEpley", () => {
  it("returns the weight itself for a single rep", () => {
    expect(estimate1RmEpley(100, 1)).toBe(100);
  });

  it("increases with reps", () => {
    expect(estimate1RmEpley(100, 5)).toBeCloseTo(116.67, 1);
    expect(estimate1RmEpley(100, 10)).toBeCloseTo(133.33, 1);
  });

  it("is 0 for invalid input", () => {
    expect(estimate1RmEpley(0, 5)).toBe(0);
    expect(estimate1RmEpley(100, 0)).toBe(0);
  });
});

describe("estimate1RmBrzycki", () => {
  it("returns the weight itself for a single rep", () => {
    expect(estimate1RmBrzycki(100, 1)).toBe(100);
  });

  it("matches known reference values", () => {
    expect(estimate1RmBrzycki(100, 10)).toBeCloseTo(133.3, 0);
  });
});

describe("estimate1Rm", () => {
  it("is reliable within the documented rep range", () => {
    const result = estimate1Rm(100, MAX_RELIABLE_REPS_FOR_1RM);
    expect(result.reliable).toBe(true);
    expect(result.epleyKg).not.toBeNull();
    expect(result.brzyckiKg).not.toBeNull();
  });

  it("refuses to estimate beyond the reliable rep range", () => {
    const result = estimate1Rm(60, MAX_RELIABLE_REPS_FOR_1RM + 1);
    expect(result.reliable).toBe(false);
    expect(result.epleyKg).toBeNull();
    expect(result.brzyckiKg).toBeNull();
  });

  it("refuses to estimate from a zero/invalid set", () => {
    expect(estimate1Rm(0, 5).reliable).toBe(false);
    expect(estimate1Rm(100, 0).reliable).toBe(false);
  });
});
