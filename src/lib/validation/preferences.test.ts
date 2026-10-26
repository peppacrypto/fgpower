import { describe, expect, it } from "vitest";
import { workoutPreferencesSchema } from "./preferences";

describe("workoutPreferencesSchema", () => {
  it("accepts the two switches, on or off", () => {
    for (const restTimerSound of [true, false]) {
      for (const hapticsEnabled of [true, false]) {
        expect(workoutPreferencesSchema.safeParse({ restTimerSound, hapticsEnabled }).success).toBe(true);
      }
    }
  });

  it("refuses the retired load step and any other key", () => {
    // "Salto de carga" moved to Minha academia: an old client's block never writes it back.
    expect(workoutPreferencesSchema.safeParse({ restTimerSound: true, hapticsEnabled: false, loadIncrementKg: 2.5 }).success).toBe(false);
    expect(workoutPreferencesSchema.safeParse({ restTimerSound: true, hapticsEnabled: false, unitSystem: "IMPERIAL" }).success).toBe(false);
  });

  it("refuses a missing or non-boolean switch", () => {
    expect(workoutPreferencesSchema.safeParse({ restTimerSound: true }).success).toBe(false);
    expect(workoutPreferencesSchema.safeParse({ restTimerSound: "true", hapticsEnabled: false }).success).toBe(false);
    expect(workoutPreferencesSchema.safeParse(null).success).toBe(false);
  });
});
