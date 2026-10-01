import { describe, expect, it } from "vitest";
import {
  BODY_KINDS,
  checkBodyValue,
  formatBodyDelta,
  formatRate,
  measurementWeek,
  movingAverage7,
  weeklyRate,
} from "./body-weight";

const MINUS = "−";

describe("body kinds", () => {
  it("offers weight and six circumferences, never CUSTOM", () => {
    expect(BODY_KINDS.map((k) => k.kind)).toEqual(["BODYWEIGHT", "WAIST", "CHEST", "HIPS", "ARM", "THIGH", "CALF"]);
    expect(checkBodyValue("CUSTOM", 50)).toEqual({ ok: false, error: "Medida desconhecida." });
  });

  it("checks each kind's range and rounds to 0.1", () => {
    expect(checkBodyValue("BODYWEIGHT", 81.44)).toEqual({ ok: true, value: 81.4, unit: "kg" });
    expect(checkBodyValue("BODYWEIGHT", 814)).toEqual({ ok: false, error: "Confira o valor: entre 25 e 350 kg" });
    expect(checkBodyValue("BODYWEIGHT", 24.9)).toMatchObject({ ok: false });
    expect(checkBodyValue("WAIST", 84)).toEqual({ ok: true, value: 84, unit: "cm" });
    expect(checkBodyValue("ARM", 71)).toEqual({ ok: false, error: "Confira o valor: entre 15 e 70 cm" });
    expect(checkBodyValue("CALF", Number.NaN)).toMatchObject({ ok: false });
    expect(checkBodyValue("CALF", "38")).toMatchObject({ ok: false });
  });
});

describe("movingAverage7", () => {
  it("needs 3 weigh-ins in the trailing 7 days, and averages the ones there", () => {
    const points = movingAverage7([
      { day: 100, value: 82 },
      { day: 101, value: 81 },
      { day: 103, value: 80.5 },
      { day: 110, value: 80 },
    ]);
    expect(points.map((p) => p.avg)).toEqual([null, null, 81.2, null]);
  });

  it("drops the window's old end after 7 days and keeps the latest value of a day", () => {
    const points = movingAverage7([
      { day: 1, value: 90 },
      { day: 5, value: 80 },
      { day: 6, value: 80 },
      { day: 7, value: 80 },
      { day: 8, value: 81 },
      { day: 8, value: 80 },
    ]);
    // Day 7: days 1–7 → (90 + 80 + 80 + 80) / 4; day 8: days 2–8, day 1 out.
    expect(points.find((p) => p.day === 7)?.avg).toBe(82.5);
    expect(points.find((p) => p.day === 8)).toEqual({ day: 8, value: 80, avg: 80 });
  });
});

describe("weeklyRate / formatRate", () => {
  const daily = (from: number, to: number, value: (d: number) => number) =>
    Array.from({ length: to - from + 1 }, (_, i) => ({ day: from + i, value: value(from + i) }));

  it("compares the latest average with the one about 14 days earlier, per week", () => {
    // Losing 0.1 kg a day: 0.7 kg a week.
    const rate = weeklyRate(movingAverage7(daily(0, 28, (d) => 90 - d * 0.1)));
    expect(rate?.kgPerWeek).toBeCloseTo(-0.7, 5);
    expect(formatRate(rate!)).toBe(`${MINUS}0,7 kg/sem (${MINUS}0,8%)`);
  });

  it("is null without an average 11–17 days back", () => {
    expect(weeklyRate(movingAverage7(daily(0, 9, () => 80)))).toBeNull();
    expect(weeklyRate([])).toBeNull();
  });

  it("reads 'estável' under 0.05 kg a week, and a gain with a plus", () => {
    expect(formatRate({ kgPerWeek: 0.04, pctPerWeek: 0.05 })).toBe("estável");
    expect(formatRate({ kgPerWeek: -0.049, pctPerWeek: -0.06 })).toBe("estável");
    expect(formatRate({ kgPerWeek: 0.25, pctPerWeek: 0.31 })).toBe("+0,3 kg/sem (+0,3%)");
  });

  it("drops the percentage when asked (Progress's Corpo card)", () => {
    expect(formatRate({ kgPerWeek: -0.42, pctPerWeek: -0.5 }, { percent: false })).toBe(`${MINUS}0,4 kg/sem`);
    expect(formatRate({ kgPerWeek: 0.01, pctPerWeek: 0.01 }, { percent: false })).toBe("estável");
  });

  it("signs a measurement's change with a true minus", () => {
    expect(formatBodyDelta(-1.5, "cm")).toBe(`${MINUS}1,5 cm`);
    expect(formatBodyDelta(0.02, "cm")).toBe("sem mudança");
  });
});

describe("measurementWeek", () => {
  it("asks for measurements in a GD block's first and last weeks", () => {
    expect(measurementWeek({ templateSlug: "gd-1", week: 1, durationWeeks: 13 })).toBe("measure");
    expect(measurementWeek({ templateSlug: "gd-1", week: 13, durationWeeks: 13 })).toBe("measure");
    expect(measurementWeek({ templateSlug: "gd-8", week: 9, durationWeeks: 9 })).toBe("measure");
    expect(measurementWeek({ templateSlug: "gd-1", week: 7, durationWeeks: 13 })).toBeNull();
  });

  it("asks for a daily weigh-in in GD Adaptação's first week, and nothing elsewhere", () => {
    expect(measurementWeek({ templateSlug: "gd-adaptacao", week: 1, durationWeeks: 4 })).toBe("weigh");
    expect(measurementWeek({ templateSlug: "gd-adaptacao", week: 4, durationWeeks: 4 })).toBeNull();
    expect(measurementWeek({ templateSlug: "ppl-6x", week: 1, durationWeeks: 8 })).toBeNull();
    expect(measurementWeek({ templateSlug: null, week: 1, durationWeeks: null })).toBeNull();
  });
});
