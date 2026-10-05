import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { analyzeProgram, type ProgramRuleDay } from "./rules";
import { layOutWeek } from "./schedule";

/**
 * A-011 CI guard: no curated template, laid out on its default week (the
 * activation layout with no preferred days), ships a "heavy legs on consecutive
 * days" notice — except the by-design squat specializations. Reads the real
 * seeded catalog with the same projection analyzeUserProgram uses.
 */
afterAll(async () => {
  await prisma.$disconnect();
});

// A by-design squat specialization (advanced, never an auto-recommendation):
// its back-to-back heavy squat days are intentional (orientação, não proibição).
const BY_DESIGN = new Set(["high-frequency-squat"]);

describe("analyzeProgram on the seeded catalog (A-011)", () => {
  it("no recommended template ships a consecutive-lower-body notice", async () => {
    const templates = await prisma.workoutTemplate.findMany({
      where: { isPublished: true },
      select: {
        slug: true,
        daysPerWeek: true,
        days: {
          orderBy: { dayIndex: "asc" },
          select: {
            dayIndex: true,
            nameEn: true,
            namePt: true,
            exercises: {
              orderBy: { sortOrder: "asc" },
              select: {
                exerciseId: true,
                sets: true,
                rirTarget: true,
                exercise: {
                  select: {
                    nameEn: true,
                    namePt: true,
                    category: true,
                    mechanics: true,
                    movementPattern: { select: { id: true } },
                    muscles: { select: { role: true, muscle: { select: { group: true } } } },
                  },
                },
              },
            },
          },
        },
      },
    });
    expect(templates.length).toBeGreaterThan(0);

    for (const t of templates) {
      if (BY_DESIGN.has(t.slug)) continue;
      const weekdays = layOutWeek(
        t.days.map((d) => ({ name: d.namePt })),
        t.daysPerWeek,
        [],
      ).weekdays;
      const ruleDays: ProgramRuleDay[] = t.days.map((d, i) => ({
        dayIndex: d.dayIndex,
        nameEn: d.nameEn,
        namePt: d.namePt,
        weekday: weekdays[i] ?? null,
        exercises: d.exercises.map((ex) => ({
          exerciseId: ex.exerciseId,
          nameEn: ex.exercise.nameEn,
          namePt: ex.exercise.namePt,
          primaryMuscleGroups: ex.exercise.muscles
            .filter((m) => m.role === "PRIMARY")
            .map((m) => m.muscle.group as never),
          movementPattern: ex.exercise.movementPattern?.id ?? null,
          mechanics: ex.exercise.mechanics,
          rirTarget: ex.rirTarget,
          sets: ex.sets,
          category: ex.exercise.category,
        })),
      }));
      const feedback = analyzeProgram(ruleDays, { sessionsPerWeek: t.daysPerWeek });
      expect(
        feedback.filter((f) => f.code.startsWith("consecutive-lower-body")),
        t.slug,
      ).toEqual([]);
    }
  });
});
