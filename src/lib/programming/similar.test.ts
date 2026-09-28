import { describe, expect, it } from "vitest";
import { CATALOG_FIXTURE } from "./catalog-fixture";
import { similarPrograms } from "./similar";

const bySlug = (slug: string) => CATALOG_FIXTURE.find((t) => t.slug === slug)!;

describe("similarPrograms", () => {
  it("offers programs with the same goal family and a nearby level, never the program itself", () => {
    const current = bySlug("push-pull-legs");
    const similar = similarPrograms(current, CATALOG_FIXTURE);
    expect(similar.length).toBeGreaterThan(0);
    expect(similar.length).toBeLessThanOrEqual(3);
    for (const t of similar) {
      expect(t.slug).not.toBe(current.slug);
      expect(["HYPERTROPHY", "STRENGTH_HYPERTROPHY"]).toContain(t.goal);
    }
  });

  it("never crosses goal families or skips a level, whatever the score", () => {
    const LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
    const FAMILY: Record<string, string> = {
      HYPERTROPHY: "size",
      STRENGTH_HYPERTROPHY: "size",
      GENERAL_FITNESS: "fitness",
      FAT_LOSS: "fitness",
    };
    const fam = (g: string) => FAMILY[g] ?? g;
    for (const current of CATALOG_FIXTURE) {
      for (const t of similarPrograms(current, CATALOG_FIXTURE, 10)) {
        expect(fam(t.goal), `${current.slug} → ${t.slug}`).toBe(fam(current.goal));
        const gap = Math.abs(LEVELS.indexOf(t.experienceLevel) - LEVELS.indexOf(current.experienceLevel));
        expect(gap, `${current.slug} → ${t.slug}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("keeps the GD series out of a GD block's list and mid-series blocks out of everyone's", () => {
    for (const t of similarPrograms(bySlug("gd-3"), CATALOG_FIXTURE, 10)) expect(t.slug.startsWith("gd-")).toBe(false);
    for (const current of CATALOG_FIXTURE.filter((t) => !t.slug.startsWith("gd-"))) {
      for (const t of similarPrograms(current, CATALOG_FIXTURE, 10)) {
        expect(["gd-2", "gd-3", "gd-4", "gd-5", "gd-6", "gd-7", "gd-8"]).not.toContain(t.slug);
      }
    }
  });
});
