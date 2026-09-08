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
