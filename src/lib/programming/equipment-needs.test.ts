import { describe, expect, it } from "vitest";
import {
  gearBlockingAny,
  gearLabelOf,
  gearListPt,
  joinPt,
  missingEquipment,
  missingGearFlag,
  needLabels,
  neededEquipment,
} from "./equipment-needs";

describe("equipment needs", () => {
  it("lists what a program needs, least likely at home first, bodyweight never", () => {
    expect(neededEquipment(["dumbbell", "bodyweight", "machine", "cable", "machine", null, "none"])).toEqual([
      "machine",
      "cable",
      "dumbbell",
    ]);
    expect(needLabels(["barbell", "ez-bar", "cable"])).toEqual(["cabos", "barra", "barra W"]);
  });

  it("joins the way it is said", () => {
    expect(joinPt([])).toBe("");
    expect(joinPt(["máquinas"])).toBe("máquinas");
    expect(joinPt(["máquinas", "cabos", "barra"])).toBe("máquinas, cabos e barra");
  });

  it("finds what a user's equipment lacks (nothing for a full gym)", () => {
    const home = ["dumbbell", "bodyweight", "none", "kettlebell"];
    expect(missingEquipment(["machine", "dumbbell", "bodyweight"], home)).toEqual(["machine"]);
    expect(missingEquipment(["dumbbell", "bodyweight"], home)).toEqual([]);
    expect(missingEquipment(["machine", "cable"], null)).toEqual([]);
  });
});

describe("the gym's gear in words", () => {
  // Slugs the curated gear map never lists (it names catalog exercises only):
  // each is judged by its catalog tag (lib/exercises/gear).
  const barbell = { slug: "zz-test-barbell-lift", equipmentId: "barbell" };
  const dumbbell = { slug: "zz-test-dumbbell-lift", equipmentId: "dumbbell" };
  const cable = { slug: "zz-test-cable-pull", equipmentId: "cable" };
  const machine = { slug: "zz-test-machine", equipmentId: "machine" };
  const bodyweight = { slug: "zz-test-bodyweight", equipmentId: "bodyweight" };

  it("names an exercise by the apparatus a user can mark, never by a catch-all", () => {
    expect(gearLabelOf(barbell)).toBe("Barra e anilhas");
    expect(gearLabelOf(cable)).toBe("Crossover / polia");
    // "Outra máquina" says less than the catalog's own "Máquina": no label.
    expect(gearLabelOf(machine)).toBeNull();
    expect(gearLabelOf(bodyweight)).toBeNull();
  });

  it("lists gear as it is said, in Settings' order, once each", () => {
    expect(gearListPt(["leg-curl-lying", "hack-squat"])).toBe("Hack e Mesa flexora");
    expect(gearListPt(["hack-squat", "hack-squat"])).toBe("Hack");
    expect(gearListPt(["barbell", "pec-deck", "dumbbells"])).toBe("Halteres, Barra e anilhas e Voador (peck deck)");
  });

  it("flags a row only when the gym lacks what it needs", () => {
    expect(missingGearFlag([])).toBeNull();
    expect(missingGearFlag(["hack-squat"])).toBe("Sem aparelho: Hack");
    expect(missingGearFlag(["cable-crossover", "low-row"])).toBe("Sem aparelho: Crossover / polia e Remada baixa");
  });

  it("gathers what keeps the gym from a plan, in Settings' order", () => {
    const plan = [barbell, dumbbell, bodyweight, barbell];
    expect(gearBlockingAny(plan, ["barbell", "dumbbells", "kettlebells"])).toEqual(["dumbbells", "barbell"]);
    expect(gearBlockingAny(plan, new Set(["kettlebells"]))).toEqual([]);
    expect(gearBlockingAny([], ["barbell"])).toEqual([]);
  });
});
