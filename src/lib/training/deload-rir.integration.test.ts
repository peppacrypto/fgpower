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

describe("the GD numbered blocks anchor their benchmark free-weight compounds on the wave-start week (A-021)", () => {
  it("an E=3 free-weight compound reads RIR 3 at the wave-opening weeks and ≤2.5 at the mid-wave weeks", async () => {
    const blocks = await prisma.workoutTemplate.findMany({
      where: { slug: { in: ["gd-1", "gd-2", "gd-3", "gd-4", "gd-5", "gd-6", "gd-7", "gd-8"] } },
      select: { slug: true, durationWeeks: true, weeklyGuidance: true },
    });
    expect(blocks.length).toBe(8);
    // A benchmark free-weight compound authored at the wave-start effort (E = 3),
    // with no note that raises its own floor — the bench/squat top sets A-021 is about.
    const benchmark = { freeWeightCompound: true, notes: null, timed: false };
    let waveOpeningWeeksChecked = 0;
    let midWaveWeeksChecked = 0;
    for (const t of blocks) {
      const baseline = baselineRir(t.weeklyGuidance, t.slug);
      // Every numbered block anchors on its week-2 opening (RIR 2,5), not the lower median (2).
      expect(baseline, t.slug).toBe(2.5);
      for (const w of parseWeeklyGuidance(t.weeklyGuidance)) {
        if (w.rirTarget == null) continue;
        const guidance = getWeekGuidance(t.weeklyGuidance, w.week, { templateSlug: t.slug, durationWeeks: t.durationWeeks });
        if (guidance?.deload) continue; // deload weeks clamp to 3–4 (A-018), not part of the wave
        const target = weekRirTarget(3, guidance, { baseline, exercise: benchmark });
        if (w.rirTarget === 2.5) {
          // Wave-opening week: the benchmark lift is exactly on the note (RIR 3).
          expect(target, `${t.slug} wk${w.week}`).toBe(3);
          waveOpeningWeeksChecked++;
        } else if (w.rirTarget < 2.5) {
          // Mid-wave / hard week: within 0,5 of the note — never a full RIR too easy.
          expect(target, `${t.slug} wk${w.week}`).toBeLessThanOrEqual(2.5);
          midWaveWeeksChecked++;
        }
      }
    }
    expect(waveOpeningWeeksChecked).toBeGreaterThan(0);
    expect(midWaveWeeksChecked).toBeGreaterThan(0);
  });
});
