import { describe, expect, it } from "vitest";
import { parseWeekTargetSnapshot, weekTargetOf } from "./week-target";

describe("weekTargetOf", () => {
  it("a non-repeating plan targets its trainable days", () => {
    expect(weekTargetOf(3, 3, 3)).toBe(3);
    expect(weekTargetOf(3, 5, 5)).toBe(5); // 5 days trained 3× still asks for all 5
  });
  it("a repeating plan (more sessions than days) targets the frequency", () => {
    expect(weekTargetOf(3, 2, 2)).toBe(3); // A/B @ 3×
    expect(weekTargetOf(4, 3, 3)).toBe(4);
  });
  it("a plan with no trainable day falls back to at least one session", () => {
    expect(weekTargetOf(3, 0, 4)).toBe(3);
    expect(weekTargetOf(0, 0, 0)).toBe(1);
  });
});

describe("parseWeekTargetSnapshot", () => {
  it("reads a well-formed snapshot", () => {
    expect(parseWeekTargetSnapshot({ daysPerWeek: 3, trainableDays: 2, dayCount: 2 })).toEqual({
      daysPerWeek: 3,
      trainableDays: 2,
      dayCount: 2,
    });
  });
  it("rejects null, non-objects and malformed values", () => {
    expect(parseWeekTargetSnapshot(null)).toBeNull();
    expect(parseWeekTargetSnapshot("x")).toBeNull();
    expect(parseWeekTargetSnapshot({ daysPerWeek: 3 })).toBeNull();
    expect(parseWeekTargetSnapshot({ daysPerWeek: 3, trainableDays: -1, dayCount: 2 })).toBeNull();
    expect(parseWeekTargetSnapshot({ daysPerWeek: 3.5, trainableDays: 2, dayCount: 2 })).toBeNull();
  });
});
