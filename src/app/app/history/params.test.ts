import { describe, expect, it } from "vitest";
import { parseDayParam, parseMonthParams, parsePageParam } from "./params";

describe("parsePageParam", () => {
  it("accepts positive integers", () => {
    expect(parsePageParam("1")).toBe(1);
    expect(parsePageParam("7")).toBe(7);
  });

  it("falls back to 1 for anything else", () => {
    for (const bad of [undefined, "", "abc", "0", "-3", "2.5", "1e3", "NaN", "Infinity", "99999999999999999999"]) {
      expect(parsePageParam(bad)).toBe(1);
    }
    expect(parsePageParam(["2", "3"])).toBe(1);
  });
});

describe("parseMonthParams", () => {
  const current = { year: 2026, month0: 8 }; // September 2026

  it("keeps a valid past month", () => {
    expect(parseMonthParams({ year: "2026", month: "0" }, current)).toEqual({ year: 2026, month0: 0 });
    expect(parseMonthParams({ year: "2025", month: "11" }, current)).toEqual({ year: 2025, month0: 11 });
  });

  it("defaults to the current month when params are missing", () => {
    expect(parseMonthParams({}, current)).toEqual(current);
  });

  it("replaces malformed or out-of-range parts", () => {
    expect(parseMonthParams({ year: "abc", month: "3" }, current)).toEqual({ year: 2026, month0: 3 });
    expect(parseMonthParams({ year: "2025", month: "abc" }, current)).toEqual({ year: 2025, month0: 8 });
    expect(parseMonthParams({ year: "2025", month: "12" }, current)).toEqual({ year: 2025, month0: 8 });
    expect(parseMonthParams({ year: "2025", month: "-1" }, current)).toEqual({ year: 2025, month0: 8 });
    expect(parseMonthParams({ year: "1970", month: "2" }, current)).toEqual({ year: 2026, month0: 2 });
  });

  it("never opens a month in the future", () => {
    expect(parseMonthParams({ year: "2026", month: "10" }, current)).toEqual(current);
    expect(parseMonthParams({ year: "2031", month: "1" }, current)).toEqual({ year: 2026, month0: 1 });
  });
});

describe("parseDayParam", () => {
  it("accepts a day of the month and rejects anything else", () => {
    expect(parseDayParam("24", 30)).toBe(24);
    expect(parseDayParam("31", 31)).toBe(31);
    for (const bad of [undefined, "", "0", "31", "-1", "2.5", "abc"]) expect(parseDayParam(bad, 30)).toBeNull();
    expect(parseDayParam(["1", "2"], 30)).toBeNull();
  });
});
