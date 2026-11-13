import { describe, expect, it } from "vitest";
import { dietPlanSchema } from "@/lib/validation/diet-plan";
import { choiceLabel, dayTotals, findItem, markOf, optionOf, planItems, planTotals } from "./plan";
import testPlan from "./test-plan.json";

/** The test fixture (src/lib/diet/test-plan.json), parsed as the app reads plans. */
const plan = dietPlanSchema.parse(testPlan);
const tilapia = findItem(plan.meals, "almoco-tilapia")!.item;

describe("optionOf / choiceLabel", () => {
  it("fills an item's place with the alternative picked, else the item itself", () => {
    expect(optionOf(tilapia, null).id).toBe("almoco-tilapia");
    expect(optionOf(tilapia, "almoco-atum")).toMatchObject({ food: "Atum em lata, escorrido", kcal: 140 });
    // Its own id, or an id it doesn't have (a plan changed since): the item itself.
    expect(optionOf(tilapia, "almoco-tilapia").id).toBe("almoco-tilapia");
    expect(optionOf(tilapia, "sumiu").id).toBe("almoco-tilapia");
  });

  it("names a choice by its label, else its food up to the first comma", () => {
    expect(choiceLabel(tilapia)).toBe("Tilápia");
    expect(choiceLabel(tilapia.alternatives![0])).toBe("Atum em lata");
    expect(choiceLabel({ ...tilapia, label: undefined })).toBe("Filé de tilápia grelhado");
  });
});

describe("dayTotals", () => {
  it("adds up the eaten items only, and counts every item of the plan (an alternative is not one more)", () => {
    expect(planItems(plan.meals)).toHaveLength(5);
    expect(dayTotals(plan.meals, {})).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0, eaten: 0, items: 5 });
    const t = dayTotals(plan.meals, {
      "cafe-pao": { eaten: true, choiceId: null },
      "cafe-ovos": { eaten: true, choiceId: null },
      // Picked but not eaten: counts for nothing.
      "almoco-arroz": { eaten: false, choiceId: null },
    });
    expect(t).toEqual({ kcal: 270, protein: 18.5, carbs: 23, fat: 11.5, eaten: 2, items: 5 });
  });

  it("counts an item by the option that filled it: the alternative's numbers on its day", () => {
    const withTilapia = dayTotals(plan.meals, { "almoco-tilapia": { eaten: true, choiceId: null } });
    const withAtum = dayTotals(plan.meals, { "almoco-tilapia": { eaten: true, choiceId: "almoco-atum" } });
    expect(withTilapia).toMatchObject({ kcal: 190, protein: 39, fat: 4, eaten: 1 });
    expect(withAtum).toMatchObject({ kcal: 140, protein: 31, fat: 1.2, eaten: 1 });
  });

  it("ignores marks for ids the plan doesn't have, inherited names included", () => {
    const t = dayTotals(plan.meals, { "item-antigo": { eaten: true, choiceId: null } });
    expect(t).toMatchObject({ kcal: 0, eaten: 0, items: 5 });
    // A plan whose item is called "constructor" reads no Object.prototype member as its mark.
    expect(markOf({}, "constructor")).toEqual({ eaten: false, choiceId: null });
    expect(markOf({}, "toString")).toEqual({ eaten: false, choiceId: null });
  });

  it("rounds sums to 0.1 (no 18.499999…)", () => {
    const meals = [
      {
        id: "m",
        name: "M",
        items: [
          { id: "a", food: "A", amount: "1", kcal: 0.1, protein: 0.1, carbs: 0.2, fat: 0.7 },
          { id: "b", food: "B", amount: "1", kcal: 0.2, protein: 0.2, carbs: 0.1, fat: 0.1 },
        ],
      },
    ];
    const t = dayTotals(meals, { a: { eaten: true, choiceId: null }, b: { eaten: true, choiceId: null } });
    expect([t.kcal, t.protein, t.carbs, t.fat]).toEqual([0.3, 0.3, 0.3, 0.8]);
  });

  it("planTotals: the whole plan eaten as written", () => {
    expect(planTotals(plan.meals)).toEqual({ kcal: 680, protein: 67.5, carbs: 64, fat: 16.8, eaten: 5, items: 5 });
  });
});
