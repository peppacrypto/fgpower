import { describe, expect, it } from "vitest";
import { analyzeProgram, type ProgramRuleDay, type ProgramRuleExercise } from "./rules";

function exercise(overrides: Partial<ProgramRuleExercise>): ProgramRuleExercise {
  return {
    exerciseId: "ex",
    nameEn: "Exercise",
    namePt: "Exercício",
    primaryMuscleGroups: ["CHEST"],
    movementPattern: "horizontal-push",
    sets: 3,
    ...overrides,
  };
}

describe("analyzeProgram — weekly volume", () => {
  it("flags a muscle group under the low-volume threshold", () => {
    const days: ProgramRuleDay[] = [
      {
        dayIndex: 0,
        nameEn: "Day A",
        namePt: "Dia A",
        exercises: [exercise({ primaryMuscleGroups: ["SHOULDERS"], sets: 2 })],
      },
    ];
    const feedback = analyzeProgram(days);
    expect(feedback.some((f) => f.code === "low-volume-shoulders")).toBe(true);
  });

  it("flags a muscle group over the high-volume threshold", () => {
    const days: ProgramRuleDay[] = [
      { dayIndex: 0, nameEn: "A", namePt: "A", exercises: [exercise({ primaryMuscleGroups: ["CHEST"], sets: 15 })] },
      { dayIndex: 1, nameEn: "B", namePt: "B", exercises: [exercise({ primaryMuscleGroups: ["CHEST"], sets: 15 })] },
    ];
    const feedback = analyzeProgram(days);
    expect(feedback.some((f) => f.code === "high-volume-chest")).toBe(true);
  });

  it("does not flag a muscle group within the acceptable range", () => {
    const days: ProgramRuleDay[] = [
      { dayIndex: 0, nameEn: "A", namePt: "A", exercises: [exercise({ primaryMuscleGroups: ["BACK"], sets: 10 })] },
    ];
    const feedback = analyzeProgram(days);
    expect(feedback.some((f) => f.code.includes("volume-back"))).toBe(false);
  });
});

const QUADS = { id: "quadriceps", nameEn: "Quadriceps", namePt: "Quadríceps" };
const HAMS = { id: "hamstrings", nameEn: "Hamstrings", namePt: "Isquiotibiais" };
const CALVES = { id: "calves", nameEn: "Calves", namePt: "Panturrilhas" };
const GLUTES = { id: "glutes", nameEn: "Glutes", namePt: "Glúteos" };

describe("analyzeProgram — weekly volume per muscle (muscle-level data)", () => {
  it("does not sum separate leg muscles into one group total", () => {
    const legs = (primary: typeof QUADS, sets: number) =>
      exercise({ primaryMuscleGroups: ["LEGS"], primaryMuscles: [primary], secondaryMuscles: [], sets });
    const days: ProgramRuleDay[] = [
      { dayIndex: 0, nameEn: "A", namePt: "A", exercises: [legs(QUADS, 7), legs(HAMS, 5), legs(CALVES, 4)] },
      { dayIndex: 2, nameEn: "B", namePt: "B", exercises: [legs(QUADS, 7), legs(HAMS, 5), legs(CALVES, 4)] },
    ];
    const feedback = analyzeProgram(days);
    // 32 LEGS sets would trip the legacy group rule; per muscle every total is well under the threshold.
    expect(feedback.some((f) => f.code.startsWith("high-volume"))).toBe(false);
  });

  it("counts synergist sets at half credit before calling a muscle under-trained", () => {
    const days: ProgramRuleDay[] = [
      {
        dayIndex: 0,
        nameEn: "A",
        namePt: "A",
        exercises: [
          exercise({ primaryMuscleGroups: ["GLUTES"], primaryMuscles: [GLUTES], secondaryMuscles: [], sets: 3 }),
          exercise({ primaryMuscleGroups: ["LEGS"], primaryMuscles: [QUADS], secondaryMuscles: [GLUTES], sets: 4 }),
        ],
      },
    ];
    const feedback = analyzeProgram(days);
    // glutes: 3 direct + 0.5 x 4 = 5 fractional sets
    expect(feedback.some((f) => f.code === "low-volume-glutes")).toBe(false);
  });

  it("flags a muscle whose fractional weekly sets stay under the low threshold", () => {
    const days: ProgramRuleDay[] = [
      {
        dayIndex: 0,
        nameEn: "A",
        namePt: "A",
        exercises: [exercise({ primaryMuscleGroups: ["LEGS"], primaryMuscles: [CALVES], secondaryMuscles: [], sets: 2 })],
      },
    ];
    const low = analyzeProgram(days).find((f) => f.code === "low-volume-calves");
    expect(low?.messagePt).toContain("Panturrilhas");
  });

  it("flags direct sets for one muscle over the high threshold", () => {
    const quads = exercise({ primaryMuscleGroups: ["LEGS"], primaryMuscles: [QUADS], secondaryMuscles: [], sets: 10 });
    const days: ProgramRuleDay[] = [0, 2, 4].map((i) => ({ dayIndex: i, nameEn: `D${i}`, namePt: `D${i}`, exercises: [quads] }));
    expect(analyzeProgram(days).some((f) => f.code === "high-volume-quadriceps")).toBe(true);
  });
});

describe("analyzeProgram — session volume", () => {
  it("flags a day with too many total working sets", () => {
    const days: ProgramRuleDay[] = [
      {
        dayIndex: 0,
        nameEn: "Big Day",
        namePt: "Dia Grande",
        exercises: Array.from({ length: 11 }, (_, i) => exercise({ exerciseId: `ex-${i}`, sets: 3 })),
      },
    ];
    const feedback = analyzeProgram(days);
    expect(feedback.some((f) => f.code === "high-session-volume-day-0")).toBe(true);
  });
});

describe("analyzeProgram — duplicate movement patterns", () => {
  it("flags 3+ exercises sharing a movement pattern in one day", () => {
    const days: ProgramRuleDay[] = [
      {
        dayIndex: 0,
        nameEn: "Push",
        namePt: "Push",
        exercises: [
          exercise({ exerciseId: "a", movementPattern: "horizontal-push" }),
          exercise({ exerciseId: "b", movementPattern: "horizontal-push" }),
          exercise({ exerciseId: "c", movementPattern: "horizontal-push" }),
        ],
      },
    ];
    const feedback = analyzeProgram(days);
    expect(feedback.some((f) => f.code.startsWith("similar-movements-day-0"))).toBe(true);
  });

  it("does not flag two exercises sharing a pattern", () => {
    const days: ProgramRuleDay[] = [
      {
        dayIndex: 0,
        nameEn: "Push",
        namePt: "Push",
        exercises: [
          exercise({ exerciseId: "a", movementPattern: "horizontal-push" }),
          exercise({ exerciseId: "b", movementPattern: "horizontal-push" }),
        ],
      },
    ];
    const feedback = analyzeProgram(days);
    expect(feedback.some((f) => f.code.startsWith("similar-movements"))).toBe(false);
  });
});

describe("analyzeProgram — consecutive lower body days", () => {
  it("flags two consecutive heavy lower-body days", () => {
    const legDay = (i: number): ProgramRuleDay => ({
      dayIndex: i,
      nameEn: `Legs ${i}`,
      namePt: `Pernas ${i}`,
      exercises: [exercise({ primaryMuscleGroups: ["LEGS"], sets: 4, movementPattern: "squat" })],
    });
    const feedback = analyzeProgram([legDay(0), legDay(1)]);
    expect(feedback.some((f) => f.code.startsWith("consecutive-lower-body"))).toBe(true);
  });

  it("does not flag non-consecutive lower-body days", () => {
    const legDay = (i: number): ProgramRuleDay => ({
      dayIndex: i,
      nameEn: `Legs ${i}`,
      namePt: `Pernas ${i}`,
      exercises: [exercise({ primaryMuscleGroups: ["LEGS"], sets: 4 })],
    });
    const upperDay: ProgramRuleDay = {
      dayIndex: 1,
      nameEn: "Upper",
      namePt: "Superior",
      exercises: [exercise({ primaryMuscleGroups: ["CHEST"], sets: 4 })],
    };
    const feedback = analyzeProgram([legDay(0), upperDay, legDay(2)]);
    expect(feedback.some((f) => f.code.startsWith("consecutive-lower-body"))).toBe(false);
  });
});

describe("analyzeProgram — missing horizontal pull", () => {
  it("flags a program with vertical pulling but no horizontal pulling", () => {
    const days: ProgramRuleDay[] = [
      {
        dayIndex: 0,
        nameEn: "Back",
        namePt: "Costas",
        exercises: [exercise({ movementPattern: "vertical-pull", primaryMuscleGroups: ["BACK"] })],
      },
    ];
    const feedback = analyzeProgram(days);
    expect(feedback.some((f) => f.code === "no-horizontal-pull")).toBe(true);
  });

  it("does not flag a balanced pulling program", () => {
    const days: ProgramRuleDay[] = [
      {
        dayIndex: 0,
        nameEn: "Back",
        namePt: "Costas",
        exercises: [
          exercise({ exerciseId: "a", movementPattern: "vertical-pull", primaryMuscleGroups: ["BACK"] }),
          exercise({ exerciseId: "b", movementPattern: "horizontal-pull", primaryMuscleGroups: ["BACK"] }),
        ],
      },
    ];
    const feedback = analyzeProgram(days);
    expect(feedback.some((f) => f.code === "no-horizontal-pull")).toBe(false);
  });
});
