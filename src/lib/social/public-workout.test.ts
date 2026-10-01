import { describe, expect, it } from "vitest";
import {
  compactVolume,
  exerciseLine,
  formatShareDate,
  statsLine,
  storyStats,
  stripEmoji,
  toPublicWorkoutView,
  truncate,
} from "./public-workout";

/** A summary as older versions stored it: a load left in prs[].value with the loads hidden, a skipped exercise, repeated kinds. */
const legacy = {
  workoutName: "Segunda — Superior",
  durationSeconds: 3480,
  totalWorkingSets: 7,
  totalVolumeKg: 12400,
  exercises: [
    { name: "Supino Reto", workingSets: 4, bestSet: { weightKg: 80, reps: 8 } },
    { name: "Crucifixo", workingSets: 0, bestSet: null },
    { name: "Prancha", workingSets: 3, bestSet: { weightKg: 0, reps: 45 }, timed: true },
  ],
  prs: [
    { exerciseName: "Supino Reto", kind: "MAX_WEIGHT", value: 80, weightKg: 80, reps: 8 },
    { exerciseName: "Supino Reto", kind: "ESTIMATED_1RM", value: 99.2, weightKg: 80, reps: 8 },
    { exerciseName: "Supino Reto", kind: "SESSION_VOLUME", value: 2560, weightKg: null, reps: null },
    { exerciseName: "Remada", kind: "MAX_REPS_AT_WEIGHT", value: 12, weightKg: 60, reps: 12 },
  ],
};

describe("toPublicWorkoutView", () => {
  it("with the loads hidden, no load survives — even from a legacy summary", () => {
    const view = toPublicWorkoutView(legacy, false);
    expect(view.totalVolumeKg).toBeNull();
    expect(view.exercises.every((e) => e.bestSet === null)).toBe(true);
    const text = JSON.stringify(view);
    expect(text).not.toMatch(/kg/);
    expect(text).not.toContain("99");
    expect(text).not.toContain("2560");
    expect(view.records).toEqual([
      { exerciseName: "Supino Reto", text: "recorde de carga · 1RM estimado" },
      { exerciseName: "Remada", text: "recorde de 12 reps" },
    ]);
  });

  it("with the loads shown, keeps the best set, the volume and the record values", () => {
    const view = toPublicWorkoutView(legacy, true);
    expect(view.totalVolumeKg).toBe(12400);
    expect(view.exercises[0].bestSet).toEqual({ weightKg: 80, reps: 8 });
    expect(exerciseLine(view.exercises[0])).toBe("4 séries · 80 kg × 8");
    // A hold's reps are seconds, and a set without load prints no "0 kg".
    expect(exerciseLine(view.exercises[1])).toBe("3 séries · 45 s");
    expect(view.records[0].text).toBe("carga 80 kg · 1RM est. 99,2 kg");
  });

  it("drops exercises with no set done and never lists SESSION_VOLUME", () => {
    const view = toPublicWorkoutView(legacy, true);
    expect(view.exercises.map((e) => e.name)).toEqual(["Supino Reto", "Prancha"]);
    expect(view.records.map((r) => r.exerciseName)).toEqual(["Supino Reto", "Remada"]);
  });

  it("says a hold's records in seconds, never its e1RM (prs[].timed)", () => {
    const holds = {
      workoutName: "Core",
      exercises: [
        { name: "Prancha", workingSets: 3, bestSet: { weightKg: 0, reps: 45 }, timed: true },
        { name: "Pinça com Anilha", workingSets: 2, bestSet: { weightKg: 10, reps: 40 }, timed: true },
        { name: "Ponte Lateral", workingSets: 2, bestSet: { weightKg: 20, reps: 8 }, timed: true },
        { name: "Supino Reto", workingSets: 3, bestSet: { weightKg: 80, reps: 8 } },
      ],
      prs: [
        { exerciseName: "Prancha", kind: "MAX_REPS_AT_WEIGHT", value: 45, weightKg: 0, reps: 45, timed: true },
        { exerciseName: "Prancha", kind: "ESTIMATED_1RM", value: 12, weightKg: 0, reps: 45, timed: true },
        { exerciseName: "Pinça com Anilha", kind: "MAX_REPS_AT_WEIGHT", value: 40, weightKg: 10, reps: 40, timed: true },
        // Only an e1RM: nothing a hold can say.
        { exerciseName: "Ponte Lateral", kind: "ESTIMATED_1RM", value: 23.3, weightKg: 20, reps: 8, timed: true },
        { exerciseName: "Supino Reto", kind: "MAX_REPS_AT_WEIGHT", value: 12, weightKg: 60, reps: 12, timed: false },
      ],
    };
    expect(toPublicWorkoutView(holds, true).records).toEqual([
      { exerciseName: "Prancha", text: "45 s" },
      { exerciseName: "Pinça com Anilha", text: "40 s com 10 kg" },
      { exerciseName: "Supino Reto", text: "12 reps com 60 kg" },
    ]);
    // Stored with the loads hidden (no weights, no e1RM value): the time stays, the load goes.
    const hidden = toPublicWorkoutView(
      {
        ...holds,
        prs: holds.prs.map((p) => ({ ...p, value: p.kind === "MAX_REPS_AT_WEIGHT" ? p.value : null, weightKg: null })),
      },
      false,
    );
    expect(hidden.records).toEqual([
      { exerciseName: "Prancha", text: "recorde de 45 s" },
      { exerciseName: "Pinça com Anilha", text: "recorde de 40 s" },
      { exerciseName: "Supino Reto", text: "recorde de 12 reps" },
    ]);
    expect(JSON.stringify(hidden)).not.toMatch(/kg/);
  });

  it("reads a record as a hold from its exercise when the record isn't flagged (older summaries)", () => {
    const view = toPublicWorkoutView(
      {
        exercises: [{ name: "Prancha", workingSets: 2, bestSet: null, timed: true }],
        prs: [{ exerciseName: "Prancha", kind: "MAX_REPS_AT_WEIGHT", value: 50, weightKg: 0, reps: 50 }],
      },
      true,
    );
    expect(view.records).toEqual([{ exerciseName: "Prancha", text: "50 s" }]);
  });

  it("survives garbage", () => {
    for (const bad of [null, undefined, 42, "x", [], { exercises: "no", prs: [null, 1] }]) {
      const view = toPublicWorkoutView(bad, true);
      expect(view.workoutName).toBe("Treino");
      expect(view.exercises).toEqual([]);
      expect(view.records).toEqual([]);
    }
  });
});

describe("share helpers", () => {
  it("storyStats picks Exercícios instead of Volume when the loads are hidden", () => {
    expect(storyStats(toPublicWorkoutView(legacy, true), 3480).map((s) => s.label)).toEqual(["Duração", "Séries", "Volume"]);
    const hidden = storyStats(toPublicWorkoutView(legacy, false), 3480);
    expect(hidden.map((s) => s.label)).toEqual(["Duração", "Séries", "Exercícios"]);
    expect(hidden[2].value).toBe("2");
    expect(storyStats(toPublicWorkoutView(legacy, true), 3480)[2].value).toBe("12,4 t");
  });

  it("statsLine says the volume only with the loads", () => {
    expect(statsLine(toPublicWorkoutView(legacy, true), 3480)).toBe(
      "58 min · 7 séries de trabalho · 12.400 kg de volume",
    );
    expect(statsLine(toPublicWorkoutView(legacy, false), null)).toBe("58 min · 7 séries de trabalho");
  });

  it("dates on the São Paulo calendar", () => {
    expect(formatShareDate(new Date("2026-09-29T02:00:00Z"))).toBe("28 set 2026");
    expect(formatShareDate(new Date("2026-01-01T03:00:00Z"))).toBe("1 jan 2026");
  });

  it("compacts volumes", () => {
    expect(compactVolume(12400)).toBe("12,4 t");
    expect(compactVolume(1000)).toBe("1 t");
    expect(compactVolume(850)).toBe("850 kg");
  });

  it("strips emoji for image renders", () => {
    expect(stripEmoji("Treino pesado 💪🔥 hoje")).toBe("Treino pesado hoje");
    expect(stripEmoji("👍🏽 Bora")).toBe("Bora");
    expect(stripEmoji("Ação — São Paulo × 2")).toBe("Ação — São Paulo × 2");
  });

  it("truncates on a character boundary", () => {
    expect(truncate("abcdef", 10)).toBe("abcdef");
    expect(truncate("abcdef", 4)).toBe("abc…");
  });
});
