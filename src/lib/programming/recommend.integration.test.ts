import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { EQUIPMENT_FOR_ACCESS } from "@/lib/data/alternatives";
import { listTemplates, toCatalogItem } from "@/lib/data/templates";
import { ACCESS_EQUIPMENT, recommendTemplates, templateFit, type RecommendProfile } from "./recommend";

/**
 * The recommender over the real seeded catalog (L-home-catalog-gap): what
 * each home access level is offered, judged by the equipment its exercises
 * actually use.
 */
afterAll(async () => {
  await prisma.$disconnect();
});

const profile = (p: Partial<RecommendProfile>): RecommendProfile => ({
  goal: "GENERAL_FITNESS",
  experience: "BEGINNER",
  daysPerWeek: 3,
  sessionMinutes: 60,
  equipmentAccess: "FULL_GYM",
  ...p,
});

describe("recommendTemplates on the seeded catalog", () => {
  it("reads the same equipment lists as the stand-ins (lib/data/alternatives)", () => {
    expect(ACCESS_EQUIPMENT).toEqual(EQUIPMENT_FOR_ACCESS);
  });

  it("gives MINIMAL and HOME_BODYWEIGHT three picks at 2, 3 and 4 days, the first one runnable", async () => {
    const catalog = (await listTemplates()).map(toCatalogItem);
    expect(catalog.every((t) => Array.isArray(t.equipmentIds) && t.equipmentIds.length > 0)).toBe(true);
    for (const equipmentAccess of ["MINIMAL", "HOME_BODYWEIGHT"]) {
      for (const daysPerWeek of [2, 3, 4]) {
        const recs = recommendTemplates(profile({ equipmentAccess, daysPerWeek }), catalog);
        expect(recs.length, `${equipmentAccess} ${daysPerWeek}×`).toBeGreaterThanOrEqual(3);
        expect(templateFit(equipmentAccess, recs[0].template)).toBe("runnable");
        expect(recs[0].adapt).toBe(false);
      }
    }
    // A bands-and-floor user starts on the bands plan, never the kettlebell one.
    const minimal = recommendTemplates(profile({ equipmentAccess: "MINIMAL" }), catalog);
    expect(minimal[0].template.slug).toBe("bands-bodyweight-full-body");
    const kettlebell = minimal.find((r) => r.template.slug === "kettlebell-strong");
    expect(kettlebell?.reasons.some((r) => r.label.startsWith("Requer") && !r.match)).toBe(true);
    // Two days with nothing but the floor: the express plan leads.
    const bodyweight = recommendTemplates(profile({ equipmentAccess: "HOME_BODYWEIGHT", daysPerWeek: 2 }), catalog);
    expect(bodyweight[0].template.slug).toBe("bodyweight-express");
  });
});
