import { describe, expect, it } from "vitest";
import { joinPt, missingEquipment, needLabels, neededEquipment } from "./equipment-needs";

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
