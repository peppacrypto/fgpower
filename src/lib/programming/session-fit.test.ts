import { describe, expect, it } from "vitest";
import { estimateDayMinutes, MIN_WORKING_SETS, trimToSessionMinutes, type FitExercise } from "./session-fit";

const ex = (id: string, p: Partial<FitExercise> = {}): FitExercise => ({
  id,
  sets: 3,
  repMax: 10,
  restSeconds: 90,
  warmupSets: 0,
  isCompound: false,
  ...p,
});

describe("estimateDayMinutes", () => {
  it("sums setup, warm-ups and working sets (reps' time + rest)", () => {
    // 45 setup + 2*50 warm-up + 3*(10*4 + 120) = 45 + 100 + 480 = 625s ≈ 10 min.
    expect(estimateDayMinutes([ex("a", { sets: 3, repMax: 10, restSeconds: 120, warmupSets: 2, isCompound: true })])).toBe(10);
  });

  it("is additive over a day", () => {
    const a = ex("a", { sets: 3, repMax: 10, restSeconds: 90, warmupSets: 0 });
    const b = ex("b", { sets: 4, repMax: 8, restSeconds: 60, warmupSets: 1 });
    expect(estimateDayMinutes([a, b])).toBe(estimateDayMinutes([a]) + estimateDayMinutes([b]));
  });
});

describe("trimToSessionMinutes", () => {
  it("leaves a day already within budget untouched", () => {
    const day = [ex("c", { isCompound: true }), ex("a1"), ex("a2")];
    const r = trimToSessionMinutes(day, 999);
    expect(r.trims.size).toBe(0);
    expect(r.estAfterMinutes).toBe(r.estBeforeMinutes);
  });

  it("trims nothing when the target is zero or negative", () => {
    const day = [ex("a1", { sets: 5 }), ex("a2", { sets: 5 })];
    expect(trimToSessionMinutes(day, 0).trims.size).toBe(0);
    expect(trimToSessionMinutes(day, -10).trims.size).toBe(0);
  });

  it("shaves the LAST accessory first, down to the floor, then the one before — never the compound", () => {
    const c = ex("c", { sets: 4, repMax: 5, restSeconds: 180, warmupSets: 3, isCompound: true });
    const a1 = ex("a1", { sets: 4, repMax: 12, restSeconds: 60 });
    const a2 = ex("a2", { sets: 4, repMax: 15, restSeconds: 45 });
    const r = trimToSessionMinutes([c, a1, a2], 25);
    // The compound is preserved whole; both accessories drained to the floor.
    expect(r.trims.has("c")).toBe(false);
    expect(r.trims.get("a2")).toBe(MIN_WORKING_SETS);
    expect(r.trims.get("a1")).toBe(MIN_WORKING_SETS);
    expect(r.estAfterMinutes).toBeLessThan(r.estBeforeMinutes);
  });

  it("stops as soon as the day fits — a one-set overshoot trims only the last accessory", () => {
    const a1 = ex("a1", { sets: 3, repMax: 10, restSeconds: 60 });
    const a2 = ex("a2", { sets: 3, repMax: 10, restSeconds: 60 });
    const c = ex("c", { sets: 3, repMax: 6, restSeconds: 120, warmupSets: 1, isCompound: true });
    const r = trimToSessionMinutes([a1, a2, c], 19);
    expect(r.trims.size).toBe(1);
    expect(r.trims.get("a2")).toBe(2);
  });

  it("never drops a compound-only day below its sets, even when way over budget", () => {
    const day = [ex("c1", { sets: 5, isCompound: true }), ex("c2", { sets: 5, isCompound: true })];
    expect(trimToSessionMinutes(day, 1).trims.size).toBe(0);
  });

  it("honours a higher minimum-sets floor", () => {
    const day = [ex("a1", { sets: 5, repMax: 15, restSeconds: 90 }), ex("a2", { sets: 5, repMax: 15, restSeconds: 90 })];
    const r = trimToSessionMinutes(day, 10, { minWorkingSets: 4 });
    for (const [, sets] of r.trims) expect(sets).toBeGreaterThanOrEqual(4);
  });
});
