import { describe, expect, it } from "vitest";
import { sessionVolumeKg, workingSetCount, totalReps, type VolumeSet } from "./volume";

function set(overrides: Partial<VolumeSet>): VolumeSet {
  return { weightKg: 60, reps: 10, setType: "WORKING", isCompleted: true, ...overrides };
}

describe("sessionVolumeKg", () => {
  it("sums weight × reps across completed working sets", () => {
    const sets = [set({ weightKg: 60, reps: 10 }), set({ weightKg: 62.5, reps: 8 })];
    expect(sessionVolumeKg(sets)).toBe(60 * 10 + 62.5 * 8);
  });

  it("excludes warm-up sets", () => {
    const sets = [set({ setType: "WARMUP", weightKg: 20, reps: 10 }), set({ weightKg: 60, reps: 10 })];
    expect(sessionVolumeKg(sets)).toBe(600);
  });

  it("excludes incomplete sets", () => {
    const sets = [set({ isCompleted: false }), set({ weightKg: 60, reps: 10 })];
    expect(sessionVolumeKg(sets)).toBe(600);
  });

  it("excludes sets missing weight or reps", () => {
    const sets = [set({ weightKg: null }), set({ reps: null }), set({ weightKg: 60, reps: 10 })];
    expect(sessionVolumeKg(sets)).toBe(600);
  });

  it("returns 0 for an empty session", () => {
    expect(sessionVolumeKg([])).toBe(0);
  });
});

describe("workingSetCount", () => {
  it("counts only completed non-warmup sets", () => {
    const sets = [
      set({ setType: "WARMUP" }),
      set({ setType: "WORKING" }),
      set({ setType: "WORKING", isCompleted: false }),
      set({ setType: "DROP" }),
    ];
    expect(workingSetCount(sets)).toBe(2);
  });
});

describe("totalReps", () => {
  it("sums reps across completed working sets only", () => {
    const sets = [set({ reps: 10 }), set({ reps: 8 }), set({ setType: "WARMUP", reps: 15 })];
    expect(totalReps(sets)).toBe(18);
  });
});
