import { describe, expect, it } from "vitest";
import {
  describeRecord,
  detectExerciseRecords,
  groupRecordsByExercise,
  isShownPrKind,
  type PriorSet,
  type ScoredSet,
} from "./personal-records-core";

let n = 0;
const sets = (weightKg: number, ...reps: number[]): ScoredSet[] => reps.map((r) => ({ id: `s${++n}`, weightKg, reps: r }));
const prior = (weightKg: number, ...reps: number[]): PriorSet[] => reps.map((r) => ({ weightKg, reps: r }));
const kinds = (r: ReturnType<typeof detectExerciseRecords>) => r.records.map((x) => x.kind);

describe("detectExerciseRecords — baseline", () => {
  it("records nothing the first time an exercise is logged", () => {
    const r = detectExerciseRecords(sets(60, 10, 10, 9), []);
    expect(r).toEqual({ baseline: true, records: [] });
  });

  it("is not a baseline when nothing usable was logged", () => {
    expect(detectExerciseRecords([], [])).toEqual({ baseline: false, records: [] });
  });

  it("a lighter second session records nothing (the baseline marks count as history)", () => {
    const r = detectExerciseRecords(sets(55, 10, 10, 10), prior(60, 10, 10, 9));
    expect(r.records).toEqual([]);
  });
});

describe("detectExerciseRecords — rep records (double progression)", () => {
  it("tied straight sets: 60×12,13,13,12 after a best of 60×12 is a 13-rep record", () => {
    const now = sets(60, 12, 13, 13, 12);
    const r = detectExerciseRecords(now, prior(60, 12, 11, 10));
    const rep = r.records.find((x) => x.kind === "MAX_REPS_AT_WEIGHT");
    expect(rep).toMatchObject({ value: 13, weightKg: 60, reps: 13, setLogId: now[1].id });
  });

  it("3×12 after 3×10 at the same load is a rep record", () => {
    const r = detectExerciseRecords(sets(60, 12, 12, 12), prior(60, 10, 10, 10));
    expect(r.records).toEqual([expect.objectContaining({ kind: "MAX_REPS_AT_WEIGHT", value: 12, weightKg: 60 })]);
  });

  it("matching the best is not a record", () => {
    expect(detectExerciseRecords(sets(60, 12, 12, 12), prior(60, 12, 11, 10)).records).toEqual([]);
  });

  it("more reps with a lighter load don't block a rep record at a heavier one", () => {
    const r = detectExerciseRecords(sets(60, 11), [...prior(40, 15), ...prior(60, 9)]);
    expect(kinds(r)).toContain("MAX_REPS_AT_WEIGHT");
  });

  it("as many reps already done with more weight is not a record", () => {
    const r = detectExerciseRecords(sets(55, 10), [...prior(55, 8), ...prior(60, 12)]);
    expect(kinds(r)).not.toContain("MAX_REPS_AT_WEIGHT");
  });

  it("a load never used before is not a rep record (lighter one-off)", () => {
    const r = detectExerciseRecords(sets(50, 12), prior(60, 10));
    expect(r.records).toEqual([]);
  });

  it("bodyweight sets (0 kg) earn rep records, and nothing else", () => {
    const r = detectExerciseRecords(sets(0, 12, 10), prior(0, 10, 9));
    expect(r.records).toEqual([expect.objectContaining({ kind: "MAX_REPS_AT_WEIGHT", value: 12, weightKg: 0 })]);
  });

  it("records one rep record per load already used", () => {
    const r = detectExerciseRecords([...sets(60, 11), ...sets(70, 8)], [...prior(60, 10), ...prior(70, 6)]);
    expect(r.records.filter((x) => x.kind === "MAX_REPS_AT_WEIGHT").map((x) => x.weightKg)).toEqual([60, 70]);
  });
});

describe("detectExerciseRecords — load and e1RM records", () => {
  it("a heavier load is a weight record carried by its best set", () => {
    const now = sets(62.5, 8, 9);
    const r = detectExerciseRecords(now, prior(60, 10, 10));
    expect(r.records.find((x) => x.kind === "MAX_WEIGHT")).toMatchObject({ value: 62.5, reps: 9, setLogId: now[1].id });
  });

  it("a better reliable estimate is an e1RM record", () => {
    const r = detectExerciseRecords(sets(60, 10), prior(60, 8));
    expect(r.records.find((x) => x.kind === "ESTIMATED_1RM")).toMatchObject({ value: 80, weightKg: 60, reps: 10 });
  });

  it("no e1RM record without an earlier reliable estimate (history above 10 reps)", () => {
    const r = detectExerciseRecords(sets(50, 8), prior(40, 15));
    expect(kinds(r)).toEqual(["MAX_WEIGHT"]);
  });

  it("no e1RM record for a set no better than one already done (30×10 after 30×12)", () => {
    const r = detectExerciseRecords(sets(30, 12, 10), prior(30, 12, 7));
    expect(kinds(r)).not.toContain("ESTIMATED_1RM");
  });

  it("no e1RM record from sets above 10 reps", () => {
    const r = detectExerciseRecords(sets(60, 12, 12, 12), prior(60, 10, 10, 10));
    expect(kinds(r)).not.toContain("ESTIMATED_1RM");
  });
});

describe("describeRecord", () => {
  // formatKg joins number and unit with a non-breaking space.
  const text = (...args: Parameters<typeof describeRecord>) => describeRecord(...args).replace(/\u00a0/g, " ");

  it("writes pt-BR numbers with the unit", () => {
    expect(text({ kind: "MAX_WEIGHT", value: 65, weightKg: 65, reps: 5 })).toBe("carga 65 kg");
    expect(text({ kind: "ESTIMATED_1RM", value: 79.2, weightKg: 60, reps: 10 })).toBe("1RM est. 79,2 kg");
    expect(text({ kind: "MAX_REPS_AT_WEIGHT", value: 13, weightKg: 62.5, reps: 13 })).toBe("13 reps com 62,5 kg");
    expect(text({ kind: "MAX_REPS_AT_WEIGHT", value: 15, weightKg: 0, reps: 15 })).toBe("15 reps (peso corporal)");
  });

  it("falls back to the kind's name when loads are hidden", () => {
    expect(describeRecord({ kind: "MAX_WEIGHT", value: null, weightKg: null, reps: null })).toBe("recorde de carga");
    expect(describeRecord({ kind: "ESTIMATED_1RM", value: 80, weightKg: 60, reps: 10 }, true)).toBe("1RM estimado");
    expect(describeRecord({ kind: "MAX_REPS_AT_WEIGHT", value: 13, weightKg: null, reps: null })).toBe("recorde de 13 reps");
  });
});

describe("groupRecordsByExercise", () => {
  it("one entry per exercise in workout order, kinds in display order, no session volume", () => {
    const rows = [
      { ex: "b", kind: "SESSION_VOLUME" },
      { ex: "b", kind: "MAX_REPS_AT_WEIGHT" },
      { ex: "a", kind: "ESTIMATED_1RM" },
      { ex: "b", kind: "MAX_WEIGHT" },
      { ex: "a", kind: "MAX_WEIGHT" },
      { ex: "c", kind: "SESSION_VOLUME" },
    ];
    const groups = groupRecordsByExercise(rows, (r) => r.ex, ["a", "b", "c"]);
    expect(groups.map((g) => [g.key, g.records.map((r) => r.kind)])).toEqual([
      ["a", ["MAX_WEIGHT", "ESTIMATED_1RM"]],
      ["b", ["MAX_WEIGHT", "MAX_REPS_AT_WEIGHT"]],
    ]);
  });

  it("knows which kinds are shown", () => {
    expect(isShownPrKind("SESSION_VOLUME")).toBe(false);
    expect(isShownPrKind("MAX_WEIGHT")).toBe(true);
  });
});
