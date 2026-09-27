import { describe, expect, it } from "vitest";
import { CATALOG_FIXTURE } from "./catalog-fixture";
import { beginnerEntrySlug, canRun, isMidSeriesGd, recommendTemplates, type RecommendProfile } from "./recommend";

const profile = (p: Partial<RecommendProfile> = {}): RecommendProfile => ({
  goal: "HYPERTROPHY",
  experience: "BEGINNER",
  daysPerWeek: 3,
  sessionMinutes: 60,
  equipmentAccess: "FULL_GYM",
  ...p,
});
const top = (p: Partial<RecommendProfile>, n = 3) =>
  recommendTemplates(profile(p), CATALOG_FIXTURE)
    .slice(0, n)
    .map((r) => r.template.slug);

describe("recommendTemplates", () => {
  it("never offers a program the user's equipment can't run", () => {
    for (const equipmentAccess of ["HOME_DUMBBELLS", "HOME_BODYWEIGHT", "MINIMAL"]) {
      const recs = recommendTemplates(profile({ equipmentAccess }), CATALOG_FIXTURE);
      expect(recs.length).toBeGreaterThan(0);
      for (const r of recs) expect(canRun(equipmentAccess, r.template.equipmentAccess)).toBe(true);
    }
    expect(top({ equipmentAccess: "HOME_BODYWEIGHT" }, 5)).toEqual(["calisthenics"]);
  });

  it("starts a 3-day gym beginner on the flagship adaptation, with beginner full-body alternates", () => {
    expect(top({})).toEqual(["fgpower-adaptation", "full-body-beginner", "linear-5x5"]);
  });

  it("starts a 5-day gym beginner on the GD series entry, then GD 1", () => {
    expect(top({ daysPerWeek: 5 }, 2)).toEqual(["gd-adaptacao", "gd-1"]);
    expect(beginnerEntrySlug(profile({ daysPerWeek: 6 }))).toBe("gd-adaptacao");
  });

  it("doesn't pin the flagship when its sessions are far longer than the user has", () => {
    const [first] = top({ goal: "STRENGTH", daysPerWeek: 2, sessionMinutes: 30 }, 1);
    expect(first).not.toBe("fgpower-adaptation");
  });

  it("gives a home-dumbbell beginner a dumbbell plan that fits their week", () => {
    const home = { equipmentAccess: "HOME_DUMBBELLS", sessionMinutes: 45 };
    // 2×/45 min: the 2-day, 40-min all-dumbbell plan — not the 3×/55-min one.
    expect(top({ ...home, daysPerWeek: 2 }, 1)).toEqual(["full-body-express"]);
    // The wizard's defaults (hypertrophy, 60 min): a plan that fits the week
    // beats one that fits the goal but needs a day the user doesn't have.
    expect(top({ ...home, daysPerWeek: 2, sessionMinutes: 60 }, 2)).toEqual(["full-body-express", "home-dumbbells"]);
    expect(top({ ...home, daysPerWeek: 2, sessionMinutes: 90 }, 1)).toEqual(["full-body-express"]);
    expect(top({ ...home, goal: "GENERAL_FITNESS", daysPerWeek: 2 }, 1)).toEqual(["full-body-express"]);
    // 3×: the 3-day dumbbell plan for hypertrophy; for fitness in 45 min, the
    // one that fits the session leads, and both dumbbell plans beat bodyweight.
    expect(top({ ...home, daysPerWeek: 3 }, 1)).toEqual(["home-dumbbells"]);
    expect(top({ ...home, daysPerWeek: 3, sessionMinutes: 60 }, 1)).toEqual(["home-dumbbells"]);
    expect(top({ ...home, goal: "GENERAL_FITNESS" }, 3)).toEqual(["full-body-express", "home-dumbbells", "calisthenics"]);
  });

  it("offers the 2-day dumbbell plan only to those who own dumbbells or a gym", () => {
    const express = (equipmentAccess: string) =>
      recommendTemplates(profile({ equipmentAccess }), CATALOG_FIXTURE).some((r) => r.template.slug === "full-body-express");
    expect(express("HOME_DUMBBELLS")).toBe(true);
    expect(express("FULL_GYM")).toBe(true);
    expect(express("MINIMAL")).toBe(false);
    expect(express("HOME_BODYWEIGHT")).toBe(false);
  });

  it("scores fat loss as general fitness, favoring full-body plans", () => {
    const [, ...alternates] = top({ goal: "FAT_LOSS" });
    expect(alternates).toEqual(["machines-only-beginner", "full-body-beginner"]);
  });

  it("matches days, level and time for someone who already trains", () => {
    const recs = recommendTemplates(
      profile({ goal: "STRENGTH_HYPERTROPHY", experience: "INTERMEDIATE", daysPerWeek: 4 }),
      CATALOG_FIXTURE,
    ).slice(0, 3);
    for (const r of recs) {
      expect(r.template.daysPerWeek).toBe(4);
      expect(r.template.experienceLevel).toBe("INTERMEDIATE");
    }
  });

  it("offers sport plans to athletes and keeps them away from everyone else", () => {
    const athlete = top({ goal: "SPORTS_PERFORMANCE", experience: "INTERMEDIATE", doesEndurance: true }, 1);
    expect(athlete).toEqual(["strength-for-runners"]);
    const general = recommendTemplates(profile({ experience: "INTERMEDIATE" }), CATALOG_FIXTURE).slice(0, 5);
    expect(general.some((r) => r.template.goal === "SPORTS_PERFORMANCE")).toBe(false);
  });

  it("never leads with a specialization, a one-week deload or an advanced block for a beginner", () => {
    for (const daysPerWeek of [2, 3, 4, 5, 6]) {
      for (const goal of ["HYPERTROPHY", "STRENGTH", "GENERAL_FITNESS", "FAT_LOSS", "STRENGTH_HYPERTROPHY"]) {
        const [first] = recommendTemplates(profile({ daysPerWeek, goal }), CATALOG_FIXTURE);
        expect(["arms-specialization", "active-deload"]).not.toContain(first.template.slug);
        expect(first.template.experienceLevel).toBe("BEGINNER");
      }
    }
  });

  // Every combination of onboarding answers.
  const everyProfile = function* () {
    for (const goal of ["HYPERTROPHY", "STRENGTH", "STRENGTH_HYPERTROPHY", "GENERAL_FITNESS", "FAT_LOSS", "SPORTS_PERFORMANCE"])
      for (const experience of ["BEGINNER", "INTERMEDIATE", "ADVANCED"])
        for (const daysPerWeek of [2, 3, 4, 5, 6])
          for (const sessionMinutes of [30, 45, 60, 90])
            for (const equipmentAccess of ["FULL_GYM", "HOME_DUMBBELLS", "MINIMAL", "HOME_BODYWEIGHT"])
              for (const doesEndurance of [false, true])
                yield profile({ goal, experience, daysPerWeek, sessionMinutes, equipmentAccess, doesEndurance });
  };

  it("never starts anyone in the middle of the GD series", () => {
    for (const p of everyProfile()) {
      const [first] = recommendTemplates(p, CATALOG_FIXTURE);
      expect(isMidSeriesGd(first.template.slug), JSON.stringify(p)).toBe(false);
    }
    // An intermediate at 5 days gets a 5-day plan, not GD 4 ("meses 11-13").
    expect(top({ experience: "INTERMEDIATE", daysPerWeek: 5 }, 1)).toEqual(["classic-split"]);
    expect(top({ experience: "ADVANCED", daysPerWeek: 5 }).some(isMidSeriesGd)).toBe(false);
  });

  it("keeps someone who already trains within a day of their week", () => {
    for (const p of everyProfile()) {
      if (p.experience === "BEGINNER") continue; // a beginner's level comes first (no 4- or 5-day home plan for them)
      const recs = recommendTemplates(p, CATALOG_FIXTURE);
      if (!recs.some((r) => Math.abs(r.template.daysPerWeek - p.daysPerWeek) <= 1)) continue;
      expect(Math.abs(recs[0].template.daysPerWeek - p.daysPerWeek), JSON.stringify(p)).toBeLessThanOrEqual(1);
    }
    // Advanced, 3 days: no 5×/week plan among the picks.
    for (const r of recommendTemplates(profile({ experience: "ADVANCED" }), CATALOG_FIXTURE).slice(0, 3)) {
      expect(Math.abs(r.template.daysPerWeek - 3)).toBeLessThanOrEqual(1);
    }
  });

  it("explains a pick with chips that say which answers it matches", () => {
    const [first] = recommendTemplates(profile(), CATALOG_FIXTURE);
    expect(first.reasons).toEqual([
      { label: "3×/semana", match: true },
      { label: "Iniciante", match: true },
      { label: "Academia completa", match: true },
      { label: "60 min", match: true },
    ]);
    const [gd] = recommendTemplates(profile({ daysPerWeek: 5, sessionMinutes: 45 }), CATALOG_FIXTURE);
    expect(gd.reasons.find((r) => r.label === "47 min")?.match).toBe(false);
  });
});
