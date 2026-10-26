import { describe, expect, it } from "vitest";
import { GEAR, GEAR_GROUP_LABEL, gearName } from "@/lib/exercises/gear";
import { blockedNamesText, blockedPlanExercises, gearChecklistGroups } from "./gym-gear";

/**
 * Slugs no catalog has, so the curated gear map never names them and each
 * one needs exactly what its catalog tag says (lib/exercises/gear FALLBACK):
 * these cases hold whatever the map's content.
 */
const ex = (id: string, equipmentId: string, category = "STRENGTH") => ({ id, slug: `zz-test-${id}`, equipmentId, category });

describe("gearChecklistGroups", () => {
  it("lists every gear a user can mark, once, and none of the catch-alls", () => {
    const listed = gearChecklistGroups().flatMap((g) => g.items.map((i) => i.id));
    expect([...listed].sort()).toEqual(GEAR.filter((g) => g.listed).map((g) => g.id).sort());
    expect(new Set(listed).size).toBe(listed.length);
    expect(listed).not.toContain("other-machine");
    expect(listed).not.toContain("specialty");
  });

  it("groups them under the gym's words, in that order, each group in catalog order", () => {
    const groups = gearChecklistGroups();
    expect(groups.map((g) => g.id)).toEqual(Object.keys(GEAR_GROUP_LABEL));
    for (const group of groups) {
      expect(group.label).toBe(GEAR_GROUP_LABEL[group.id]);
      const catalogOrder = GEAR.filter((g) => g.listed && g.group === group.id).map((g) => g.id);
      expect(group.items.map((i) => i.id)).toEqual(catalogOrder);
      for (const item of group.items) expect(item.name).toBe(gearName(item.id));
    }
    const legs = groups.find((g) => g.id === "legs");
    expect(legs?.items).toContainEqual({ id: "hack-squat", name: "Hack" });
  });
});

describe("blockedPlanExercises", () => {
  const plan = [ex("press", "dumbbell"), ex("pushup", "bodyweight"), ex("squat", "barbell"), ex("press", "dumbbell"), ex("curl", "dumbbell")];

  it("is empty while the gym lacks nothing", () => {
    expect(blockedPlanExercises(plan, [])).toEqual([]);
  });

  it("names each exercise whose every option is missing, once, in plan order", () => {
    expect(blockedPlanExercises(plan, ["dumbbells"]).map((e) => e.id)).toEqual(["press", "curl"]);
    expect(blockedPlanExercises(plan, ["barbell", "dumbbells"]).map((e) => e.id)).toEqual(["press", "squat", "curl"]);
  });

  it("never blocks what needs no gear, whatever the gym lacks", () => {
    expect(blockedPlanExercises([ex("pushup", "bodyweight"), ex("plank", "none")], GEAR.map((g) => g.id))).toEqual([]);
  });

  it("judges by gear, not by kind: a stretch on a roller is undoable without one", () => {
    expect(blockedPlanExercises([ex("roll", "foam-roller", "STRETCHING")], ["foam-roller"]).map((e) => e.id)).toEqual(["roll"]);
  });
});

describe("blockedNamesText", () => {
  it("reads the names the way they are said, the first three and then a count", () => {
    expect(blockedNamesText([])).toBe("");
    expect(blockedNamesText(["Agachamento Hack"])).toBe("Agachamento Hack");
    expect(blockedNamesText(["Agachamento Hack", "Leg Press"])).toBe("Agachamento Hack e Leg Press");
    expect(blockedNamesText(["A", "B", "C"])).toBe("A, B e C");
    expect(blockedNamesText(["A", "B", "C", "D", "E"])).toBe("A, B, C e mais 2");
  });
});
