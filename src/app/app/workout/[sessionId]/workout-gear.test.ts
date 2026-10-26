import { describe, expect, it } from "vitest";
import { gearOf, planSlotIndex, type SlotLog } from "./workout-gear";

/** An exercise the curated gear map doesn't list: its gear comes from its catalog tag. */
const uncurated = (equipmentId: string) => ({ slug: "workout-gear-test-only", equipmentId, category: "STRENGTH" });

describe("gearOf", () => {
  it("names each apparatus and says whether the gym lacks it", () => {
    expect(gearOf(uncurated("barbell"), new Set())).toEqual([{ id: "barbell", namePt: "Barra e anilhas", missing: false }]);
    expect(gearOf(uncurated("barbell"), new Set(["barbell", "smith"]))).toEqual([
      { id: "barbell", namePt: "Barra e anilhas", missing: true },
    ]);
    expect(gearOf(uncurated("cable"), new Set())).toEqual([{ id: "cable-crossover", namePt: "Crossover / polia", missing: false }]);
  });

  it("is empty for what needs nothing a gym could lack, and for a catch-all no one can mark", () => {
    expect(gearOf(uncurated("bodyweight"), new Set(["barbell"]))).toEqual([]);
    // "machine" falls back to "Outra máquina", which Minha academia doesn't list: never missing.
    expect(gearOf(uncurated("machine"), new Set())).toEqual([]);
    expect(gearOf(uncurated("other-equipment"), new Set())).toEqual([]);
  });
});

describe("planSlotIndex", () => {
  const slot = (exerciseId: string, extra: Partial<SlotLog> = {}): SlotLog => ({
    exerciseId,
    substitutedFromExerciseId: null,
    programExercise: { id: `pe-${exerciseId}` },
    ...extra,
  });
  const added = (exerciseId: string, substitutedFromExerciseId: string | null = null): SlotLog => ({
    exerciseId,
    substitutedFromExerciseId,
    programExercise: null,
  });

  it("a log the day prescribed is its own slot — also once swapped in place", () => {
    const logs = [slot("hack"), slot("leg-press", { substitutedFromExerciseId: "extensora" })];
    expect(planSlotIndex(logs, 0)).toBe(0);
    expect(planSlotIndex(logs, 1)).toBe(1);
  });

  it("a stand-in added after an exercise with sets stands in for that exercise's slot", () => {
    // Hack with a set done, then the leg press "in place of" the Hack.
    expect(planSlotIndex([slot("hack"), added("leg-press", "hack"), slot("extensora")], 1)).toBe(0);
    // The slot had been swapped first (the Hack → Smith, with sets), then the leg press after it.
    expect(planSlotIndex([slot("smith", { substitutedFromExerciseId: "hack" }), added("leg-press", "hack")], 1)).toBe(0);
  });

  it("takes the nearest slot before it, never one after", () => {
    // A lift's top set and its back-offs (two slots of one exercise): the stand-in follows the back-offs.
    const logs = [slot("hack"), slot("hack"), added("leg-press", "hack")];
    expect(planSlotIndex(logs, 2)).toBe(1);
    expect(planSlotIndex([added("leg-press", "hack"), slot("hack")], 0)).toBeNull();
  });

  it("an exercise added to the workout is in no plan, swapped or not", () => {
    const logs = [slot("hack"), added("prancha"), added("abdominal", "prancha")];
    expect(planSlotIndex(logs, 1)).toBeNull();
    expect(planSlotIndex(logs, 2)).toBeNull();
    expect(planSlotIndex(logs, 7)).toBeNull();
  });
});
