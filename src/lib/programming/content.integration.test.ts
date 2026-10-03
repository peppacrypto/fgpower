import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { deriveGroups } from "./groups";
import { analyzeProgram, type ProgramRuleDay } from "./rules";

/**
 * The seeded content as the app reads it (run after `npx tsx prisma/seed.ts`):
 * movement patterns on the template exercises the checks read them from
 * (L-content-movement-patterns), the GD supersets (W-104) and the GD taglines
 * led by their purpose (L-gd-taglines).
 */
afterAll(async () => {
  await prisma.$disconnect();
});

/** Exercises no MovementPattern fits (scripts/validate-content.mjs PATTERNLESS). */
const PATTERNLESS = [
  "barbell-shrug",
  "cable-shrugs",
  "dumbbell-shrug",
  "isometric-neck-exercise-front-and-back",
  "plate-pinch",
  "wrist-roller",
  "external-rotation-with-cable",
  "thigh-abductor",
  "thigh-adductor",
  "kettlebell-halo",
];

describe("seeded content", () => {
  it("every template exercise a pattern can fit has one", async () => {
    const missing = await prisma.exercise.findMany({
      where: {
        movementPatternId: null,
        category: { notIn: ["CARDIO", "PLYOMETRICS", "STRETCHING"] },
        slug: { notIn: PATTERNLESS },
        templateEntries: { some: {} },
      },
      select: { slug: true },
    });
    expect(missing.map((e) => e.slug)).toEqual([]);
  });

  it("a program whose only pull is an underhand pulldown is told it has no horizontal pull", async () => {
    const pulldown = await prisma.exercise.findUniqueOrThrow({
      where: { slug: "underhand-cable-pulldowns" },
      select: { id: true, nameEn: true, namePt: true, movementPatternId: true },
    });
    expect(pulldown.movementPatternId).toBe("vertical-pull");
    const day: ProgramRuleDay = {
      dayIndex: 0,
      nameEn: "Day",
      namePt: "Dia",
      exercises: [
        {
          exerciseId: pulldown.id,
          nameEn: pulldown.nameEn,
          namePt: pulldown.namePt,
          primaryMuscleGroups: ["BACK"],
          movementPattern: pulldown.movementPatternId,
          sets: 3,
        },
      ],
    };
    expect(analyzeProgram([day]).map((f) => f.code)).toContain("no-horizontal-pull");
  });

  it("the GD blocks carry their supersets as pairs of adjacent exercises", async () => {
    const days = await prisma.workoutTemplateDay.findMany({
      where: { template: { slug: { startsWith: "gd-" } } },
      select: { exercises: { orderBy: { sortOrder: "asc" }, select: { groupKey: true } } },
    });
    const slots = days.flatMap((d) => deriveGroups(d.exercises));
    const members = slots.filter((s) => s !== null);
    expect(members.length).toBe(46);
    expect(members.every((s) => s.size === 2)).toBe(true);
    // Every stored key belongs to a real group (no lone key).
    const keyed = days.flatMap((d) => d.exercises).filter((e) => e.groupKey !== null).length;
    expect(keyed).toBe(46);
  });

  it("the GD taglines lead with what the block builds (the series line comes from elsewhere)", async () => {
    const gd = await prisma.workoutTemplate.findMany({ where: { slug: { startsWith: "gd-" } }, select: { taglinePt: true } });
    expect(gd.length).toBe(9);
    for (const t of gd) {
      expect(t.taglinePt).not.toMatch(/^Bloco \d/);
      expect(t.taglinePt.length).toBeLessThanOrEqual(160);
    }
  });

  it("the mobility programs are a complete, loadless, imaged, cited track", async () => {
    const mob = await prisma.workoutTemplate.findMany({
      where: { goal: "MOBILITY" },
      include: {
        days: { include: { exercises: { include: { exercise: { include: { media: true } } } } } },
        evidence: true,
        principles: true,
      },
    });
    // The nine authored mobility programs are all published.
    expect(mob.length).toBe(9);
    expect(mob.every((t) => t.isPublished && t.trainingStyle === "MOBILITY")).toBe(true);
    for (const t of mob) {
      expect(t.days.length).toBe(t.daysPerWeek);
      // Real week-by-week progression and real citations/principles, like every other program.
      expect(Array.isArray(t.weeklyGuidance) ? (t.weeklyGuidance as unknown[]).length : 0).toBe(t.durationWeeks);
      expect(t.evidence.length).toBeGreaterThan(0);
      expect(t.principles.length).toBeGreaterThan(0);
      for (const day of t.days) {
        expect(day.exercises.length).toBeGreaterThanOrEqual(4);
        for (const e of day.exercises) {
          // Every mobility exercise is a loadless stretch (so the workout never asks for kg)
          // and ships with its images.
          expect(e.exercise.category).toBe("STRETCHING");
          expect(e.exercise.media.length).toBeGreaterThan(0);
        }
      }
    }
  });
});
