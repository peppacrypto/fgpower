import { describe, expect, it } from "vitest";
import { analyzeProgram, type ProgramRuleDay, type ProgramRuleExercise } from "./rules";

function exercise(overrides: Partial<ProgramRuleExercise>): ProgramRuleExercise {
  return {
    exerciseId: "ex",
    nameEn: "Exercise",
    namePt: "Exercício",
    primaryMuscleGroups: ["CHEST"],
    movementPattern: "horizontal-push",
    mechanics: "COMPOUND",
    rirTarget: 2,
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

describe("analyzeProgram — stretches and cardio aren't training volume", () => {
  it("a stretch changes nothing: no volume, no session sets, no heavy leg day", () => {
    const glutes = { id: "glutes", nameEn: "Glutes", namePt: "Glúteos" };
    const lift = exercise({ primaryMuscleGroups: ["GLUTES"], primaryMuscles: [glutes], secondaryMuscles: [], sets: 2, movementPattern: "hip-extension" });
    const stretch = { ...lift, exerciseId: "stretch", sets: 30, category: "STRETCHING" };
    const without = analyzeProgram([{ dayIndex: 0, nameEn: "A", namePt: "A", exercises: [lift] }]);
    const withStretch = analyzeProgram([{ dayIndex: 0, nameEn: "A", namePt: "A", exercises: [lift, stretch] }]);
    expect(withStretch).toEqual(without);
    expect(withStretch.some((f) => f.code === "low-volume-glutes")).toBe(true);
    expect(withStretch.some((f) => f.code.startsWith("high-session-volume"))).toBe(false);
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
  const legDay = (dayIndex: number, weekday: number): ProgramRuleDay => ({
    dayIndex,
    nameEn: `Legs ${dayIndex}`,
    namePt: `Pernas ${dayIndex}`,
    weekday,
    exercises: [exercise({ primaryMuscleGroups: ["LEGS"], sets: 4, movementPattern: "squat", mechanics: "COMPOUND", rirTarget: 2 })],
  });

  it("flags two heavy compound leg days on back-to-back weekdays", () => {
    const feedback = analyzeProgram([legDay(0, 1), legDay(1, 2)]); // Mon, Tue
    expect(feedback.some((f) => f.code.startsWith("consecutive-lower-body"))).toBe(true);
  });

  it("wraps Sunday↔Monday", () => {
    const feedback = analyzeProgram([legDay(0, 0), legDay(1, 1)]); // Sun, Mon
    expect(feedback.some((f) => f.code.startsWith("consecutive-lower-body"))).toBe(true);
  });

  it("does not flag heavy leg days spaced across the week (Mon/Wed)", () => {
    const feedback = analyzeProgram([legDay(0, 1), legDay(1, 3)]);
    expect(feedback.some((f) => f.code.startsWith("consecutive-lower-body"))).toBe(false);
  });

  it("skips plans with no fixed weekday (an A/B rotation)", () => {
    const a = { ...legDay(0, 1), weekday: null };
    const b = { ...legDay(1, 2), weekday: null };
    expect(analyzeProgram([a, b]).some((f) => f.code.startsWith("consecutive-lower-body"))).toBe(false);
  });

  it("a light/technique leg day (RIR 3+) next to a heavy one is not flagged", () => {
    const heavy = legDay(0, 1);
    const technique: ProgramRuleDay = {
      dayIndex: 1,
      nameEn: "Technique",
      namePt: "Técnica",
      weekday: 2,
      exercises: [exercise({ primaryMuscleGroups: ["LEGS"], sets: 5, movementPattern: "squat", mechanics: "COMPOUND", rirTarget: 3.5 })],
    };
    expect(analyzeProgram([heavy, technique]).some((f) => f.code.startsWith("consecutive-lower-body"))).toBe(false);
  });

  it("isolation leg work (leg curls, calves) is not heavy", () => {
    const iso = (dayIndex: number, weekday: number): ProgramRuleDay => ({
      dayIndex, nameEn: "Iso", namePt: "Iso", weekday,
      exercises: [exercise({ primaryMuscleGroups: ["LEGS"], sets: 6, movementPattern: "knee-flexion", mechanics: "ISOLATION", rirTarget: 1 })],
    });
    expect(analyzeProgram([iso(0, 1), iso(1, 2)]).some((f) => f.code.startsWith("consecutive-lower-body"))).toBe(false);
  });
});

describe("analyzeProgram — no pulling at all", () => {
  it("flags a push-only program", () => {
    const day: ProgramRuleDay = {
      dayIndex: 0, nameEn: "Push", namePt: "Empurrar",
      exercises: [
        exercise({ exerciseId: "a", movementPattern: "horizontal-push" }),
        exercise({ exerciseId: "b", movementPattern: "vertical-push" }),
      ],
    };
    const feedback = analyzeProgram([day]);
    expect(feedback.some((f) => f.code === "no-pull")).toBe(true);
    expect(feedback.some((f) => f.code === "no-horizontal-pull")).toBe(false);
  });

  it("does not fire when any pull is present", () => {
    const day: ProgramRuleDay = {
      dayIndex: 0, nameEn: "PP", namePt: "PP",
      exercises: [
        exercise({ exerciseId: "a", movementPattern: "horizontal-push" }),
        exercise({ exerciseId: "b", movementPattern: "horizontal-pull", primaryMuscleGroups: ["BACK"] }),
      ],
    };
    expect(analyzeProgram([day]).some((f) => f.code === "no-pull")).toBe(false);
  });
});

describe("analyzeProgram — weekly volume scales by sessions/days", () => {
  it("an A/B plan run 3×/week counts each day 1.5×", () => {
    const abs = (dayIndex: number): ProgramRuleDay => ({
      dayIndex, nameEn: `D${dayIndex}`, namePt: `D${dayIndex}`,
      exercises: [exercise({ primaryMuscleGroups: ["ABDOMINALS" as never], primaryMuscles: [{ id: "abdominals", nameEn: "Abs", namePt: "Abdômen" }], secondaryMuscles: [], sets: 3, movementPattern: "trunk-flexion", mechanics: "ISOLATION" })],
    });
    // 3 raw sets over 2 days, run 3×/week → 3 × (3/2) = 4.5, no longer under the low threshold.
    const unscaled = analyzeProgram([abs(0)]); // 3 sets, 1 session → low
    expect(unscaled.some((f) => f.code === "low-volume-abdominals")).toBe(true);
    const scaled = analyzeProgram([abs(0), abs(1)], { sessionsPerWeek: 3 });
    expect(scaled.some((f) => f.code === "low-volume-abdominals")).toBe(false);
  });

  it("omitting sessionsPerWeek leaves volume unscaled (legacy callers)", () => {
    const day: ProgramRuleDay = {
      dayIndex: 0, nameEn: "A", namePt: "A",
      exercises: [exercise({ primaryMuscleGroups: ["SHOULDERS"], sets: 2 })],
    };
    expect(analyzeProgram([day]).some((f) => f.code === "low-volume-shoulders")).toBe(true);
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
