import { describe, expect, it } from "vitest";
import { buildWorkoutActivitySummary, toCardSummary } from "./activity-summary";

const set = (weightKg: number, reps: number) => ({ weightKg, reps, setType: "WORKING" as const, isCompleted: true });

describe("buildWorkoutActivitySummary", () => {
  it("the best set is the heaviest, then the one with the most reps at that load", () => {
    const summary = buildWorkoutActivitySummary(
      {
        name: "Dia A",
        durationSeconds: 1800,
        exerciseLogs: [{ exercise: { namePt: "Agachamento" }, sets: [set(40, 10), set(40, 11), set(40, 11)] }],
        records: [],
      },
      true,
    );
    expect(summary.exercises[0].bestSet).toEqual({ weightKg: 40, reps: 11 });
  });

  it("marks holds whose reps are seconds, by slug or by the program's note (L-bodyweight-timed-display)", () => {
    const summary = buildWorkoutActivitySummary(
      {
        name: "Dia B",
        durationSeconds: 1200,
        exerciseLogs: [
          { exerciseId: "p", exercise: { namePt: "Prancha", slug: "plank" }, sets: [set(0, 45)] },
          { exerciseId: "f", exercise: { namePt: "Flexão de Braço", slug: "pushups" }, sets: [set(0, 15)] },
          {
            exerciseId: "w",
            exercise: { namePt: "Parede", slug: "wall-sit" },
            notes: "Os números são o tempo em segundos.",
            sets: [set(0, 30)],
          },
        ],
        records: [
          { exerciseId: "p", exercise: { namePt: "Prancha", slug: "plank" }, kind: "MAX_REPS_AT_WEIGHT", value: 45, weightKg: 0, reps: 45 },
          { exerciseId: "f", exercise: { namePt: "Flexão de Braço", slug: "pushups" }, kind: "MAX_REPS_AT_WEIGHT", value: 15, weightKg: 0, reps: 15 },
        ],
      },
      false,
    );
    expect(summary.exercises.map((e) => [e.slug, e.timed])).toEqual([
      ["plank", true],
      ["pushups", false],
      ["wall-sit", true],
    ]);
    expect(summary.prs.map((p) => [p.exerciseName, p.timed])).toEqual([
      ["Prancha", true],
      ["Flexão de Braço", false],
    ]);
  });
});

describe("toCardSummary", () => {
  // Stored before record loads were stripped: the weights are still in there.
  const legacy = {
    workoutName: "Dia A",
    durationSeconds: 1800,
    totalWorkingSets: 6,
    totalVolumeKg: null,
    exercises: [{ name: "Agachamento Goblet", workingSets: 3, bestSet: null }],
    prs: [
      { exerciseName: "Agachamento Goblet", kind: "MAX_WEIGHT", value: 40, weightKg: null, reps: null },
      { exerciseName: "Agachamento Goblet", kind: "ESTIMATED_1RM", value: 50.7, weightKg: null, reps: null },
      { exerciseName: "Supino", kind: "SESSION_VOLUME", value: 1200, weightKg: null, reps: null },
      { exerciseName: "Remada", kind: "MAX_REPS_AT_WEIGHT", value: 12, weightKg: null, reps: null },
    ],
  };

  it("keeps only what the card shows: record exercise names, never their values", () => {
    const card = toCardSummary(legacy, false);
    expect(card).toEqual({
      workoutName: "Dia A",
      durationSeconds: 1800,
      totalWorkingSets: 6,
      totalVolumeKg: null,
      prNames: ["Agachamento Goblet", "Remada"],
    });
    expect(JSON.stringify(card)).not.toMatch(/50\.7|"value"|"prs"|"exercises"/);
  });

  it("drops the volume when the loads are hidden, keeps it when shown", () => {
    const withVolume = { ...legacy, totalVolumeKg: 1640 };
    expect(toCardSummary(withVolume, false).totalVolumeKg).toBeNull();
    expect(toCardSummary(withVolume, true).totalVolumeKg).toBe(1640);
    expect(toCardSummary(withVolume).totalVolumeKg).toBe(1640);
  });

  it("survives a malformed row", () => {
    expect(toCardSummary(null)).toEqual({
      workoutName: "Treino",
      durationSeconds: null,
      totalWorkingSets: 0,
      totalVolumeKg: null,
      prNames: [],
    });
  });
});
