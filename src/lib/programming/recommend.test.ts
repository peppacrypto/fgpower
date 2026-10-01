import { describe, expect, it } from "vitest";
import { CATALOG_FIXTURE } from "./catalog-fixture";
import { missingEquipment } from "./equipment-needs";
import {
  ACCESS_EQUIPMENT,
  beginnerEntrySlug,
  isMidSeriesGd,
  recommendTemplates,
  seriesStanding,
  templateFit,
  type RecommendProfile,
} from "./recommend";

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
  it("after a finished GD block, the series' next block leads and the blocks behind it drop out", () => {
    const gdSlugs = (finishedGd: string[]) =>
      recommendTemplates(profile({ daysPerWeek: 5 }), CATALOG_FIXTURE, { finishedGd }).map((r) => r.template.slug);
    // GD Adaptação done: GD 1 leads, the Adaptação is gone.
    expect(gdSlugs(["gd-adaptacao"])[0]).toBe("gd-1");
    expect(gdSlugs(["gd-adaptacao"])).not.toContain("gd-adaptacao");
    // GD 1 done (with or without the Adaptação): GD 2 leads, neither earlier block is offered.
    for (const done of [["gd-1"], ["gd-adaptacao", "gd-1"]]) {
      const recs = gdSlugs(done);
      expect(recs[0]).toBe("gd-2");
      expect(recs).not.toContain("gd-1");
      expect(recs).not.toContain("gd-adaptacao");
    }
    // After GD 8 there's no next block: the plain order, without the series.
    const after8 = gdSlugs(["gd-8"]);
    expect(after8.some((s) => s.startsWith("gd-"))).toBe(false);
    // No history: the plain order, from the series' entry.
    expect(gdSlugs([])[0]).toBe("gd-adaptacao");
  });

  it("seriesStanding: the furthest block finished decides", () => {
    expect(seriesStanding({ finishedGd: ["gd-2", "gd-1"] })).toEqual({
      passed: new Set(["gd-adaptacao", "gd-1", "gd-2"]),
      next: "gd-3",
    });
    expect(seriesStanding({ finishedGd: ["gd-8"] }).next).toBeNull();
    expect(seriesStanding()).toEqual({ passed: new Set(), next: null });
    // Programs outside the series are no part of it.
    expect(seriesStanding({ finishedGd: ["upper-lower"] })).toEqual({ passed: new Set(), next: null });
    // GD 1 stopped in week 6: it's resumed, not offered fresh; the Adaptação, never done, stays.
    expect(seriesStanding({ stoppedGd: "gd-1" })).toEqual({ passed: new Set(["gd-1"]), next: null });
    // GD 3 stopped after GD 1: GD 2, never finished, stays; GD 1 and the Adaptação are behind.
    expect(seriesStanding({ finishedGd: ["gd-1"], stoppedGd: "gd-3" }).passed).toEqual(new Set(["gd-adaptacao", "gd-1", "gd-3"]));
    // GD 1 finished, GD 2 stopped mid-way: GD 2 is resumed, not started over as "the next block".
    expect(seriesStanding({ finishedGd: ["gd-1"], stoppedGd: "gd-2" }).next).toBeNull();
    // GD 2 finished, a repeat of GD 1 stopped: GD 3 still comes next.
    expect(seriesStanding({ finishedGd: ["gd-2"], stoppedGd: "gd-1" }).next).toBe("gd-3");
  });

  it("a GD block stopped mid-way isn't recommended fresh (it's resumed); a beginner who skipped the Adaptação is offered it", () => {
    const recs = recommendTemplates(profile({ daysPerWeek: 5 }), CATALOG_FIXTURE, { stoppedGd: "gd-1" }).map((r) => r.template.slug);
    expect(recs).not.toContain("gd-1");
    // The natural step back for a 5×/week beginner — not an intermediate split.
    expect(recs[0]).toBe("gd-adaptacao");
    // After a finished block, the blocks behind it stay out.
    const after = recommendTemplates(profile({ daysPerWeek: 5 }), CATALOG_FIXTURE, { finishedGd: ["gd-1"], stoppedGd: "gd-2" }).map((r) => r.template.slug);
    expect(after).not.toContain("gd-adaptacao");
    expect(after).not.toContain("gd-1");
    expect(after).not.toContain("gd-2");
    expect(after.length).toBeGreaterThan(0);
  });

  it("never offers a program the user's equipment can't run — or can't adapt, and says which is which", () => {
    for (const equipmentAccess of ["HOME_DUMBBELLS", "HOME_BODYWEIGHT", "MINIMAL"]) {
      const recs = recommendTemplates(profile({ equipmentAccess }), CATALOG_FIXTURE);
      expect(recs.length).toBeGreaterThan(0);
      expect(recs[0].adapt).toBe(false);
      for (const r of recs) {
        const missing = missingEquipment(r.template.equipmentIds ?? [], ACCESS_EQUIPMENT[equipmentAccess]);
        // Runnable as it is, or missing only home gear the adapt review swaps; a gym plan never.
        expect(r.adapt).toBe(missing.length > 0);
        expect(r.template.equipmentAccess).not.toBe("FULL_GYM");
        if (r.adapt) expect(r.reasons).toContainEqual({ label: "Com adaptação", match: false, kind: "adapt" });
      }
      // Runnable ones first.
      const firstAdapt = recs.findIndex((r) => r.adapt);
      if (firstAdapt >= 0) expect(recs.slice(firstAdapt).every((r) => r.adapt)).toBe(true);
    }
    const bodyweight = recommendTemplates(profile({ equipmentAccess: "HOME_BODYWEIGHT" }), CATALOG_FIXTURE);
    expect(bodyweight.filter((r) => !r.adapt).map((r) => r.template.slug).sort()).toEqual([
      "bands-bodyweight-full-body",
      "bodyweight-express",
      "calisthenics",
    ]);
  });

  it("gives home users three picks at 2, 3 and 4 days a week, the first one runnable (L-home-catalog-gap)", () => {
    for (const equipmentAccess of ["MINIMAL", "HOME_BODYWEIGHT"]) {
      for (const daysPerWeek of [2, 3, 4]) {
        const recs = recommendTemplates(profile({ equipmentAccess, daysPerWeek, goal: "GENERAL_FITNESS" }), CATALOG_FIXTURE);
        expect(recs.length, `${equipmentAccess} ${daysPerWeek}×`).toBeGreaterThanOrEqual(3);
        expect(templateFit(equipmentAccess, recs[0].template)).toBe("runnable");
      }
    }
    // Bands and the floor: the plan built on them leads, never the kettlebell one.
    expect(top({ equipmentAccess: "MINIMAL", goal: "GENERAL_FITNESS" }, 1)).toEqual(["bands-bodyweight-full-body"]);
    expect(top({ equipmentAccess: "HOME_BODYWEIGHT", daysPerWeek: 2, goal: "GENERAL_FITNESS" }, 1)).toEqual(["bodyweight-express"]);
  });

  it("never shows a kettlebell plan to 'equipamento mínimo' as a sure fit: it says what it needs", () => {
    for (const daysPerWeek of [2, 3, 4]) {
      const recs = recommendTemplates(profile({ equipmentAccess: "MINIMAL", daysPerWeek }), CATALOG_FIXTURE);
      expect(recs[0].template.slug).not.toBe("kettlebell-strong");
      const kb = recs.find((r) => r.template.slug === "kettlebell-strong");
      expect(kb?.reasons).toContainEqual({ label: "Requer halteres e kettlebell", match: false });
      expect(kb?.reasons.some((r) => r.match && r.label === "Equipamento mínimo")).toBe(false);
    }
  });

  it("gives 'equipamento mínimo' a pick it surely runs (bands and the floor), whatever the goal", () => {
    for (const goal of ["HYPERTROPHY", "GENERAL_FITNESS", "STRENGTH", "FAT_LOSS"]) {
      for (const daysPerWeek of [2, 3, 4]) {
        for (const sessionMinutes of [30, 45, 60]) {
          const [first] = recommendTemplates(profile({ equipmentAccess: "MINIMAL", goal, daysPerWeek, sessionMinutes }), CATALOG_FIXTURE);
          const needs = first.reasons.filter((r) => r.label.startsWith("Requer")).map((r) => r.label);
          expect(needs, `${goal} ${daysPerWeek}× ${sessionMinutes} min → ${first.template.slug}`).toEqual([]);
        }
      }
    }
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
    // With 30 minutes, the 40-min dumbbell plan still beats the 30-min floor-only one: it
    // uses what they own (a score, not the catalog's order, decides).
    const thirty = recommendTemplates(profile({ ...home, daysPerWeek: 2, sessionMinutes: 30 }), CATALOG_FIXTURE);
    expect(thirty[0].template.slug).toBe("full-body-express");
    const express = thirty.find((r) => r.template.slug === "bodyweight-express");
    expect(thirty[0].score).toBeGreaterThan(express?.score ?? -Infinity);
    expect(top({ ...home, goal: "GENERAL_FITNESS", daysPerWeek: 2 }, 1)).toEqual(["full-body-express"]);
    // 3×: the 3-day dumbbell plan for hypertrophy; for fitness in 45 min, the
    // one that fits the session leads. Never the bodyweight plan: it needs a
    // pull-up bar, which "halteres e talvez um banco" doesn't include.
    expect(top({ ...home, daysPerWeek: 3 }, 1)).toEqual(["home-dumbbells"]);
    expect(top({ ...home, daysPerWeek: 3, sessionMinutes: 60 }, 1)).toEqual(["home-dumbbells"]);
    expect(top({ ...home, goal: "GENERAL_FITNESS" }, 3)).toEqual(["full-body-express", "home-dumbbells", "bodyweight-express"]);
  });

  it("offers the 2-day dumbbell plan as it is only to those who may own dumbbells; to the rest, adapted", () => {
    const express = (equipmentAccess: string) =>
      recommendTemplates(profile({ equipmentAccess }), CATALOG_FIXTURE).find((r) => r.template.slug === "full-body-express");
    expect(express("HOME_DUMBBELLS")?.adapt).toBe(false);
    expect(express("FULL_GYM")?.adapt).toBe(false);
    // "Equipamento mínimo" may have dumbbells: offered, saying so.
    expect(express("MINIMAL")?.reasons).toContainEqual({ label: "Requer halteres", match: false });
    expect(express("HOME_BODYWEIGHT")?.adapt).toBe(true);
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
      // Among the plans that run as they are (those come first, whatever the week).
      const recs = recommendTemplates(p, CATALOG_FIXTURE).filter((r) => !r.adapt);
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
