import { describe, expect, it } from "vitest";
import {
  DEFAULT_GYM_LOADS,
  additiveGrid,
  describeGrid,
  dumbbellLadder,
  extendedRepCap,
  isLoadable,
  loadGridFor,
  nextLoadDown,
  nextLoadUp,
  predictedRepsAt,
  repsNeededFor,
  snapLoadDown,
  snapLoadNearest,
  stepAt,
} from "./load-grid";

const gym = DEFAULT_GYM_LOADS;

describe("dumbbellLadder", () => {
  it("spaces the usual rack 1 kg apart up to 10 kg, then 2 kg", () => {
    const l = dumbbellLadder("1-10-2");
    expect(l.slice(0, 12)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14]);
    expect(l).not.toContain(11);
    expect(l).not.toContain(14.5);
  });

  it("offers the other common racks", () => {
    expect(dumbbellLadder("2").slice(0, 4)).toEqual([2, 4, 6, 8]);
    expect(dumbbellLadder("2.5").slice(0, 4)).toEqual([2.5, 5, 7.5, 10]);
    expect(dumbbellLadder("1").slice(9, 13)).toEqual([10, 11, 12, 13]);
  });
});

describe("loadGridFor", () => {
  it("builds each equipment's grid from the gym's settings", () => {
    expect(loadGridFor("STACK", gym)).toMatchObject({ stepKg: 5, ladder: null, source: "gym" });
    expect(loadGridFor("CABLE", { ...gym, cableStepKg: 2.5 }).stepKg).toBe(2.5);
    // A bar or a two-sided plate machine takes a pair of the smallest plates; a T-bar or a belt one.
    expect(loadGridFor("BARBELL", gym).stepKg).toBe(5);
    expect(loadGridFor("PLATE_MACHINE", { ...gym, smallestPlateKg: 1.25 }).stepKg).toBe(2.5);
    expect(loadGridFor("PLATE_ONE_SIDE", gym).stepKg).toBe(2.5);
    expect(loadGridFor("BODYWEIGHT", { ...gym, smallestPlateKg: 1 }).stepKg).toBe(1);
    expect(loadGridFor("KETTLEBELL", gym).ladder?.slice(0, 4)).toEqual([4, 8, 12, 16]);
    expect(loadGridFor("KETTLEBELL", { ...gym, kettlebellStepKg: 2 }).ladder?.slice(0, 4)).toEqual([4, 6, 8, 10]);
    expect(isLoadable(loadGridFor("NONE", gym))).toBe(false);
  });

  it("lets an exercise's own step re-space a rack or replace a stack's step", () => {
    const db = loadGridFor("DUMBBELL", gym, { stepKg: 2.5, source: "exercise" });
    expect(db.ladder?.slice(0, 3)).toEqual([2.5, 5, 7.5]);
    expect(db.source).toBe("exercise");
    expect(loadGridFor("STACK", gym, { stepKg: 10, source: "program" })).toMatchObject({ stepKg: 10, source: "program" });
    // No own step (null / 0) → the gym's.
    expect(loadGridFor("STACK", gym, { stepKg: null, source: "exercise" })).toMatchObject({ stepKg: 5, source: "gym" });
    expect(loadGridFor("STACK", gym, { stepKg: 0, source: "program" }).source).toBe("gym");
    // Stating a step on a kind never loaded in kg makes it loadable.
    expect(isLoadable(loadGridFor("NONE", gym, { stepKg: 1, source: "exercise" }))).toBe(true);
  });
});

describe("moving along a grid", () => {
  const dumbbells = loadGridFor("DUMBBELL", gym);
  const stack = loadGridFor("STACK", gym);

  it("goes to the next dumbbell there is, from on- or off-rack loads", () => {
    expect(nextLoadUp(dumbbells, 9)).toBe(10);
    expect(nextLoadUp(dumbbells, 10)).toBe(12);
    expect(nextLoadUp(dumbbells, 12)).toBe(14);
    expect(nextLoadUp(dumbbells, 14.5)).toBe(16);
    expect(nextLoadDown(dumbbells, 12)).toBe(10);
    expect(nextLoadDown(dumbbells, 1)).toBeNull();
    // Past the heaviest dumbbell listed the last gap repeats.
    expect(nextLoadUp(dumbbells, 100)).toBe(102);
  });

  it("adds or removes one plate of a stack, never below one plate", () => {
    expect(nextLoadUp(stack, 40)).toBe(45);
    expect(nextLoadUp(stack, 42)).toBe(47);
    expect(nextLoadDown(stack, 45)).toBe(40);
    expect(nextLoadDown(stack, 5)).toBeNull();
    expect(stepAt(stack, 40)).toBe(5);
    expect(stepAt(dumbbells, 12)).toBe(2);
    expect(stepAt(dumbbells, 8)).toBe(1);
  });

  it("snaps a percentage to a load there is", () => {
    expect(snapLoadDown(dumbbells, 7.2)).toBe(7);
    expect(snapLoadDown(stack, 18)).toBe(15);
    expect(snapLoadDown(stack, 4)).toBeNull();
    expect(snapLoadNearest(dumbbells, 10.8)).toBe(10);
    expect(snapLoadNearest(dumbbells, 11)).toBe(12); // a tie goes up, as Math.round does
    expect(snapLoadNearest(stack, 31.25)).toBe(30);
    expect(snapLoadNearest(additiveGrid(2.5), 31.25)).toBe(32.5);
    expect(snapLoadNearest(dumbbells, 0.4)).toBe(1);
  });

  it("never moves a load that isn't progressed in kg", () => {
    const none = loadGridFor("NONE", gym);
    expect(nextLoadUp(none, 10)).toBeNull();
    expect(nextLoadDown(none, 10)).toBeNull();
    expect(stepAt(none, 10)).toBe(0);
  });
});

describe("describeGrid", () => {
  it("says the grid the way a gym-goer would", () => {
    expect(describeGrid(loadGridFor("DUMBBELL", gym))).toBe("halteres de 1 em 1 kg até 10 kg, depois de 2 em 2");
    expect(describeGrid(loadGridFor("DUMBBELL", { ...gym, dumbbellScheme: "2.5" }))).toBe("halteres de 2,5 em 2,5 kg");
    expect(describeGrid(loadGridFor("STACK", gym))).toBe("sobe de 5 kg em 5 kg");
    expect(describeGrid(loadGridFor("NONE", gym))).toBe("sem carga em kg");
  });
});

describe("reps at another load (P18 coarse increments)", () => {
  it("predicts fewer reps at a heavier load, at the same effort", () => {
    // 12 reps at RIR 2 with 12 kg → about 6 at 14 kg.
    expect(predictedRepsAt(14, 12, 12, 2)).toBeCloseTo(5.71, 1);
    expect(predictedRepsAt(12, 12, 12, 2)).toBeCloseTo(12, 6);
  });

  it("finds the reps that make the next load land in the range", () => {
    expect(repsNeededFor(14, 12, 8, 2)).toBe(15);
    expect(repsNeededFor(45, 40, 8, 2)).toBe(13);
    // The answer really lands there.
    expect(predictedRepsAt(14, 12, repsNeededFor(14, 12, 8, 2), 2)).toBeGreaterThanOrEqual(8);
  });

  it("stretches ranges to 25 reps (30 for calves and lateral raises), never past ~2× the range's top", () => {
    expect(extendedRepCap(12)).toBe(25);
    expect(extendedRepCap(15, "shoulder-abduction")).toBe(30);
    expect(extendedRepCap(15, "plantar-flexion")).toBe(30);
    expect(extendedRepCap(8)).toBe(18);
    expect(extendedRepCap(5)).toBe(12);
    expect(extendedRepCap(30)).toBe(31);
  });
});
