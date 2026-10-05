import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { baselineRir, getWeekGuidance, isDeloadGuidance, parseWeeklyGuidance, weekRirTarget } from "@/lib/training/week-guidance";
import { isTimedHold } from "@/lib/training/set-plan";

afterAll(async () => prisma.$disconnect());

describe("no seeded deload week prescribes an effort harder than RIR 3 (A-018)", () => {
  it("every published template's deload weeks clamp every loaded target to 3–4", async () => {
    const templates = await prisma.workoutTemplate.findMany({
      where: { isPublished: true },
      select: {
        slug: true,
        durationWeeks: true,
        weeklyGuidance: true,
        days: {
          select: {
            exercises: {
              select: {
                rirTarget: true,
                notesPt: true,
                exercise: { select: { slug: true, mechanics: true, equipment: { select: { category: true } } } },
              },
            },
          },
        },
      },
    });
    expect(templates.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const t of templates) {
      const baseline = baselineRir(t.weeklyGuidance);
      const deloadWeeks = parseWeeklyGuidance(t.weeklyGuidance).filter((w) => isDeloadGuidance(w));
      for (const w of deloadWeeks) {
        const guidance = getWeekGuidance(t.weeklyGuidance, w.week, { templateSlug: t.slug, durationWeeks: t.durationWeeks });
        for (const d of t.days) {
          for (const ex of d.exercises) {
            if (ex.rirTarget == null) continue;
            const timed = isTimedHold({ slug: ex.exercise.slug, notes: ex.notesPt });
            const target = weekRirTarget(ex.rirTarget, guidance, {
              baseline,
              exercise: {
                freeWeightCompound: ex.exercise.equipment?.category === "FREE_WEIGHT" && ex.exercise.mechanics === "COMPOUND",
                notes: ex.notesPt,
                timed,
              },
            });
            if (!timed && target != null && target < 3) {
              offenders.push(`${t.slug} wk${w.week} ${ex.exercise.slug}: RIR ${target}`);
            }
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
