import { describe, expect, it } from "vitest";
import {
  formatDecimal,
  isExerciseDone,
  parseDecimalInput,
  planRows,
  suggestFor,
  type PlanSet,
} from "./set-plan";

let n = 0;
function set(partial: Partial<PlanSet>): PlanSet {
  n++;
  return {
    id: `s${n}`,
    setNumber: n,
    setType: "WORKING",
    isExtra: false,
    isCompleted: false,
    weightKg: null,
    reps: null,
    ...partial,
  };
}

describe("planRows", () => {
  it("splits warm-ups, prescribed and extras with their own 1-based ordinals", () => {
    const sets = [
      set({ setNumber: 1, setType: "WARMUP" }),
      set({ setNumber: 2, setType: "WARMUP" }),
      set({ setNumber: 3 }),
      set({ setNumber: 4 }),
      set({ setNumber: 5 }),
      set({ setNumber: 6, isExtra: true }),
    ];
    const { warmups, prescribed, extras } = planRows(sets);
    expect(warmups.map((r) => r.ordinal)).toEqual([1, 2]);
    expect(prescribed.map((r) => [r.set.setNumber, r.ordinal])).toEqual([
      [3, 1],
      [4, 2],
      [5, 3],
    ]);
    expect(extras.map((r) => [r.kind, r.ordinal])).toEqual([["EXTRA", 1]]);
  });

  it("orders by setNumber regardless of input order", () => {
    const sets = [set({ setNumber: 3 }), set({ setNumber: 1 }), set({ setNumber: 2 })];
    expect(planRows(sets).prescribed.map((r) => r.set.setNumber)).toEqual([1, 2, 3]);
  });
});

describe("isExerciseDone", () => {
  it("needs every prescribed set, ignoring warm-ups and extras", () => {
    const sets = [
      set({ setNumber: 1, setType: "WARMUP" }),
      set({ setNumber: 2, isCompleted: true }),
      set({ setNumber: 3, isCompleted: true }),
      set({ setNumber: 4, isExtra: true }),
    ];
    expect(isExerciseDone(sets)).toBe(true);
    expect(isExerciseDone([...sets, set({ setNumber: 5 })])).toBe(false);
  });

  it("counts a skipped exercise as done", () => {
    expect(isExerciseDone([set({})], true)).toBe(true);
  });
});

describe("suggestFor", () => {
  const previous = [
    { weightKg: 40, reps: 10 },
    { weightKg: 42.5, reps: 9 },
    { weightKg: 42.5, reps: 8 },
    { weightKg: 20, reps: 15, isExtra: true },
  ];

  it("matches last time's set by working-set position, not raw setNumber", () => {
    expect(suggestFor("PRESCRIBED", 1, null, previous)).toEqual({ weightKg: 40, reps: 10 });
    expect(suggestFor("PRESCRIBED", 3, null, previous)).toEqual({ weightKg: 42.5, reps: 8 });
  });

  it("carries today's load from the row above, keeping last time's reps", () => {
    expect(suggestFor("PRESCRIBED", 2, { weightKg: 45, reps: 10 }, previous)).toEqual({ weightKg: 45, reps: 9 });
  });

  it("falls back to last time's last prescribed set beyond its count", () => {
    expect(suggestFor("PRESCRIBED", 5, null, previous)).toEqual({ weightKg: 42.5, reps: 8 });
  });

  it("never suggests working loads for warm-ups", () => {
    expect(suggestFor("WARMUP", 1, { weightKg: 45, reps: 10 }, previous)).toEqual({ weightKg: null, reps: null });
  });

  it("returns empty when there is no history and nothing above", () => {
    expect(suggestFor("PRESCRIBED", 1, null, [])).toEqual({ weightKg: null, reps: null });
  });
});

describe("parseDecimalInput / formatDecimal", () => {
  it("accepts pt-BR comma and dot decimals", () => {
    expect(parseDecimalInput("42,5")).toBe(42.5);
    expect(parseDecimalInput(" 42.5 ")).toBe(42.5);
    expect(parseDecimalInput("10")).toBe(10);
    expect(parseDecimalInput(",5")).toBe(0.5);
  });

  it("rejects empty and garbage", () => {
    expect(parseDecimalInput("")).toBeNull();
    expect(parseDecimalInput(",")).toBeNull();
    expect(parseDecimalInput("abc")).toBeNull();
    expect(parseDecimalInput("4,2,5")).toBeNull();
    expect(parseDecimalInput("-5")).toBeNull();
  });

  it("formats with a comma and drops trailing zeros", () => {
    expect(formatDecimal(42.5)).toBe("42,5");
    expect(formatDecimal(40)).toBe("40");
    expect(formatDecimal(null)).toBe("");
  });
});
