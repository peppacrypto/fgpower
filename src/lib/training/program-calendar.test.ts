import { describe, expect, it } from "vitest";
import { isPartialEntryWeek, seriesPosition } from "./program-calendar";

describe("seriesPosition", () => {
  it("places GD blocks in order with neighbours", () => {
    expect(seriesPosition("gd-adaptacao")).toEqual({ index: 1, total: 9, previousSlug: null, nextSlug: "gd-1" });
    expect(seriesPosition("gd-1")).toMatchObject({ index: 2, previousSlug: "gd-adaptacao", nextSlug: "gd-2" });
    expect(seriesPosition("gd-8")).toMatchObject({ index: 9, nextSlug: null });
    expect(seriesPosition("linear-5x5")).toBeNull();
  });
});

describe("entry week", () => {
  it("is partial from Thursday through Sunday (São Paulo)", () => {
    expect(isPartialEntryWeek(new Date("2026-09-21T12:00:00Z"))).toBe(false); // Monday
    expect(isPartialEntryWeek(new Date("2026-09-23T12:00:00Z"))).toBe(false); // Wednesday
    expect(isPartialEntryWeek(new Date("2026-09-24T12:00:00Z"))).toBe(true); // Thursday
    expect(isPartialEntryWeek(new Date("2026-09-28T02:00:00Z"))).toBe(true); // Sunday 23:00 SP
  });
});
