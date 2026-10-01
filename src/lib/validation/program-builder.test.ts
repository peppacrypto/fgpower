import { describe, expect, it } from "vitest";
import {
  BUILDER_LIMITS,
  REP_RANGE_MESSAGE,
  commitBuilderNumber,
  isStorableBuilderNumber,
  reconcileRepRange,
  validateBuilderProgram,
} from "./program-builder";

const exercise = (patch: Record<string, unknown> = {}) => ({
  exerciseId: "ex-1",
  exerciseName: "Supino Reto",
  groupKey: null,
  sets: 3,
  repMin: 8,
  repMax: 12,
  rirTarget: 2,
  restSeconds: 120,
  warmupSets: 0,
  loadTargetKg: null,
  notes: null,
  ...patch,
});

const program = (exercises = [exercise()], patch: Record<string, unknown> = {}) => ({
  name: "Meu PPL",
  description: "",
  days: [{ id: "day-1", name: "Dia 1", focus: null, exercises }],
  ...patch,
});

describe("commitBuilderNumber", () => {
  it("brings back the previous value when the box is left empty (never 0)", () => {
    expect(commitBuilderNumber("sets", "", 4)).toEqual({ value: 4, adjusted: null });
    expect(commitBuilderNumber("repMin", "  ", 8)).toEqual({ value: 8, adjusted: null });
    expect(commitBuilderNumber("restSeconds", "abc", 90)).toEqual({ value: 90, adjusted: null });
  });

  it("lets RIR be cleared", () => {
    expect(commitBuilderNumber("rirTarget", "", 2)).toEqual({ value: null, adjusted: null });
  });

  it("clamps into range and says which side", () => {
    expect(commitBuilderNumber("sets", "0", 3)).toEqual({ value: 1, adjusted: "min" });
    expect(commitBuilderNumber("sets", "99", 3)).toEqual({ value: BUILDER_LIMITS.sets.max, adjusted: "max" });
    expect(commitBuilderNumber("repMax", "500", 12)).toEqual({ value: 100, adjusted: "max" });
  });

  it("rounds to the field's step and accepts a decimal comma", () => {
    expect(commitBuilderNumber("rirTarget", "1,5", 2)).toEqual({ value: 1.5, adjusted: null });
    expect(commitBuilderNumber("rirTarget", "1,3", 2)).toEqual({ value: 1.5, adjusted: "step" });
    expect(commitBuilderNumber("sets", "3.4", 2)).toEqual({ value: 3, adjusted: "step" });
    expect(commitBuilderNumber("restSeconds", "100", 120)).toEqual({ value: 100, adjusted: null });
    expect(commitBuilderNumber("restSeconds", "90,4", 120)).toEqual({ value: 90, adjusted: "step" });
  });
});

describe("isStorableBuilderNumber", () => {
  it("accepts in-range values on the step only", () => {
    expect(isStorableBuilderNumber("sets", 4)).toBe(true);
    expect(isStorableBuilderNumber("sets", 0)).toBe(false);
    expect(isStorableBuilderNumber("sets", 2.5)).toBe(false);
    expect(isStorableBuilderNumber("rirTarget", 2.5)).toBe(true);
    expect(isStorableBuilderNumber("restSeconds", 100)).toBe(true);
    expect(isStorableBuilderNumber("restSeconds", 90.5)).toBe(false);
  });
});

describe("reconcileRepRange", () => {
  it("leaves a valid range alone", () => {
    expect(reconcileRepRange(8, 12, "repMin")).toEqual({ repMin: 8, repMax: 12, adjusted: null });
    expect(reconcileRepRange(10, 10, "repMax")).toEqual({ repMin: 10, repMax: 10, adjusted: null });
  });

  it("moves the other bound to the value just typed", () => {
    expect(reconcileRepRange(15, 12, "repMin")).toEqual({ repMin: 15, repMax: 15, adjusted: "repMax" });
    expect(reconcileRepRange(8, 6, "repMax")).toEqual({ repMin: 6, repMax: 6, adjusted: "repMin" });
  });
});

describe("validateBuilderProgram", () => {
  it("accepts a normal program and trims the name", () => {
    const result = validateBuilderProgram(program([exercise()], { name: "  Meu PPL  " }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.name).toBe("Meu PPL");
  });

  it("requires a name", () => {
    const result = validateBuilderProgram(program([exercise()], { name: "   " }));
    expect(result).toEqual({
      ok: false,
      errors: [{ dayIndex: null, exerciseIndex: null, field: "name", message: "Dê um nome ao programa." }],
    });
  });

  it("pins an out-of-range number to its day, exercise and field", () => {
    const result = validateBuilderProgram(program([exercise(), exercise({ sets: 0 })]));
    expect(result).toEqual({
      ok: false,
      errors: [{ dayIndex: 0, exerciseIndex: 1, field: "sets", message: "Use de 1 a 30." }],
    });
  });

  it("rejects an inverted rep range", () => {
    const result = validateBuilderProgram(program([exercise({ repMin: 15, repMax: 6 })]));
    expect(result).toEqual({
      ok: false,
      errors: [{ dayIndex: 0, exerciseIndex: 0, field: "repMin", message: REP_RANGE_MESSAGE }],
    });
  });

  it("rejects non-integer sets and absurd warm-ups", () => {
    const result = validateBuilderProgram(program([exercise({ sets: 2.5, warmupSets: 2e9 })]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.map((e) => e.field).sort()).toEqual(["sets", "warmupSets"]);
  });

  it("caps the number of days", () => {
    const days = Array.from({ length: 15 }, (_, i) => ({ name: `Dia ${i + 1}`, focus: null, exercises: [] }));
    const result = validateBuilderProgram(program([], { days }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0].field).toBe("days");
  });
});

describe("prescription helpers", () => {
  it("starts compounds heavier with longer rests than isolations", async () => {
    const { defaultPrescription } = await import("./program-builder");
    const compound = defaultPrescription("COMPOUND");
    const isolation = defaultPrescription("ISOLATION");
    expect(compound.repMax).toBeLessThan(isolation.repMax);
    expect(compound.restSeconds).toBeGreaterThan(isolation.restSeconds);
    expect(defaultPrescription(null)).toEqual({ sets: 3, repMin: 8, repMax: 12, rirTarget: 2, restSeconds: 120, warmupSets: 0 });
  });

  it("writes rest as a clock and a row in one line", async () => {
    const { formatRestClock, prescriptionLine } = await import("./program-builder");
    expect(formatRestClock(120)).toBe("2:00");
    expect(formatRestClock(90)).toBe("1:30");
    expect(formatRestClock(45)).toBe("0:45");
    expect(prescriptionLine({ sets: 3, repMin: 8, repMax: 12, rirTarget: 1.5, restSeconds: 120, warmupSets: 1 })).toBe(
      "3 × 8–12 · RIR 1,5 · 2:00 · +1 aquec.",
    );
    expect(prescriptionLine({ sets: 5, repMin: 5, repMax: 5, rirTarget: null, restSeconds: 180, warmupSets: 0 })).toBe("5 × 5 · 3:00");
    // A superset's member says where the rest goes (W-104).
    expect(
      prescriptionLine({ sets: 2, repMin: 12, repMax: 15, rirTarget: 1, restSeconds: 20, warmupSets: 0 }, { restText: "0:20 até A2" }),
    ).toBe("2 × 12–15 · RIR 1 · 0:20 até A2");
  });

  it("pins a too-long day focus and note to their fields", () => {
    const long = validateBuilderProgram(
      program([exercise({ notes: "x".repeat(2001) })], {
        days: [{ id: "d", name: "Dia 1", focus: "y".repeat(201), exercises: [exercise({ notes: "x".repeat(2001) })] }],
      }),
    );
    expect(long.ok).toBe(false);
    if (!long.ok) {
      expect(long.errors.map((e) => e.field).sort()).toEqual(["dayFocus", "notes"]);
    }
  });
});
