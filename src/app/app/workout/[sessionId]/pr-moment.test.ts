import { describe, expect, it } from "vitest";
import { detectExerciseRecords } from "@/lib/training/personal-records-core";
import { recordBars, recordRows } from "./pr-moment";

const row = (id: string, weightKg: number | null, reps: number | null) => ({ id, weightKg, reps });

describe("the PR moment (W-122)", () => {
  it("a first time is the baseline: nothing flashes", () => {
    expect([...recordRows([], [row("a", 100, 10)])]).toEqual([]);
  });

  it("a heavier set, a better estimated 1RM or more reps at a used load flashes", () => {
    const bars = recordBars([
      { weightKg: 60, reps: 10 },
      { weightKg: 60, reps: 8 },
      { weightKg: 50, reps: 12 },
    ]);
    expect([...recordRows(bars, [row("heavier", 62.5, 6)])]).toEqual(["heavier"]);
    expect([...recordRows(bars, [row("reps", 60, 11)])]).toEqual(["reps"]);
    expect([...recordRows(bars, [row("same", 60, 10)])]).toEqual([]);
    // 12 reps with 55 kg: a new load, lighter than 60 × 10 — no record of any kind.
    expect([...recordRows(bars, [row("lighter", 55, 9)])]).toEqual([]);
  });

  it("a tie with an earlier set of this workout isn't a second record", () => {
    const bars = recordBars([{ weightKg: 60, reps: 10 }]);
    expect([...recordRows(bars, [row("s1", 60, 11), row("s2", 60, 11), row("s3", 60, 12)])]).toEqual(["s1", "s3"]);
  });

  it("the reduced bars give the full history's verdicts", () => {
    let seed = 7;
    const rand = (n: number) => {
      seed = (seed * 48271) % 2147483647;
      return seed % n;
    };
    for (let t = 0; t < 400; t++) {
      const prior = Array.from({ length: 1 + rand(12) }, () => ({ weightKg: 40 + 2.5 * rand(12), reps: 1 + rand(15) }));
      const set = { id: "x", weightKg: 40 + 2.5 * rand(14), reps: 1 + rand(16) };
      const full = detectExerciseRecords([set], prior).records.map((r) => r.kind);
      const reduced = detectExerciseRecords([set], recordBars(prior)).records.map((r) => r.kind);
      expect(reduced, JSON.stringify({ prior, set })).toEqual(full);
    }
  });
});
