import { describe, expect, it } from "vitest";
import { LOAD_INCREMENT_OPTIONS, workoutPreferencesSchema } from "./preferences";

const prefs = (loadIncrementKg: number, extra: Record<string, unknown> = {}) => ({
  restTimerSound: true,
  hapticsEnabled: false,
  loadIncrementKg,
  ...extra,
});

describe("workoutPreferencesSchema", () => {
  it("accepts every offered step and a legacy quarter-kilo one", () => {
    for (const v of [...LOAD_INCREMENT_OPTIONS, 0.75]) {
      expect(workoutPreferencesSchema.safeParse(prefs(v)).success).toBe(true);
    }
  });

  it("rejects steps off the grid or out of range, and unknown keys", () => {
    for (const v of [0, 0.3, 25, Number.NaN, -1]) {
      expect(workoutPreferencesSchema.safeParse(prefs(v)).success).toBe(false);
    }
    expect(workoutPreferencesSchema.safeParse(prefs(2.5, { unitSystem: "IMPERIAL" })).success).toBe(false);
    expect(workoutPreferencesSchema.safeParse({ restTimerSound: true }).success).toBe(false);
  });
});
