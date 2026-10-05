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

describe("loaded carries and timed holds (A-056)", () => {
  it("excludes loaded carries (reps = steps) from kg-volume and reps", () => {
    const sets = [
      set({ weightKg: 40, reps: 10 }), // a real exercise → 400
      set({ weightKg: 48, reps: 40, exercise: { slug: "farmers-walk", notes: null } }), // carry → excluded
    ];
    expect(sessionVolumeKg(sets)).toBe(400);
    expect(totalReps(sets)).toBe(10);
    expect(workingSetCount(sets)).toBe(2); // still a working set
  });

  it("excludes timed holds (reps = seconds) from kg-volume and reps", () => {
    const sets = [
      set({ weightKg: 60, reps: 8 }), // 480
      set({ weightKg: 10, reps: 45, exercise: { slug: "plank", notes: null } }), // hold → excluded
    ];
    expect(sessionVolumeKg(sets)).toBe(480);
    expect(totalReps(sets)).toBe(8);
  });

  it("counts a normal exercise when its exercise is given", () => {
    const sets = [set({ weightKg: 60, reps: 10, exercise: { slug: "barbell-squat", notes: null } })];
    expect(sessionVolumeKg(sets)).toBe(600);
  });

  // Reproduces the finding's desk-worker Sessão C (3 × farmers walk 48 × 40 + a row + plank).
  it("desk-worker carry session: 720 kg (rows only), not 6.480", () => {
    const sets = [
      set({ weightKg: 48, reps: 40, exercise: { slug: "farmers-walk", notes: null } }),
      set({ weightKg: 48, reps: 40, exercise: { slug: "farmers-walk", notes: null } }),
      set({ weightKg: 48, reps: 40, exercise: { slug: "farmers-walk", notes: null } }),
      set({ weightKg: 60, reps: 12, exercise: { slug: "seated-cable-rows", notes: null } }), // 720
      set({ weightKg: 0, reps: 30, exercise: { slug: "plank", notes: null } }),
    ];
    expect(sessionVolumeKg(sets)).toBe(720);
  });
});
