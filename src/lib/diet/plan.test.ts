import { describe, expect, it } from "vitest";
import { dietPlanSchema } from "@/lib/validation/diet-plan";
import {
  MAX_PIECES,
  choiceLabel,
  countsOf,
  dayTotals,
  findItem,
  keptCounts,
  kindWords,
  markOf,
  optionOf,
  piecesAmount,
  piecesTotal,
  planItems,
  planTotals,
  servingOf,
  type DietMark,
} from "./plan";
import testPlan from "./test-plan.json";

/** The test fixture (src/lib/diet/test-plan.json), parsed as the app reads plans. */
const plan = dietPlanSchema.parse(testPlan);
const tilapia = findItem(plan.meals, "almoco-tilapia")!.item;
const ovos = findItem(plan.meals, "cafe-ovos")!.item;
const pieces = ovos.pieces!;
const COM = "cafe-ovos--com-gema";
const SEM = "cafe-ovos--sem-gema";

const eaten = (choiceId: string | null = null, counts: DietMark["counts"] = null): DietMark => ({ eaten: true, choiceId, counts });

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

describe("pieces (eggs with or without the yolk)", () => {
  it("counts by kind: the mark's own counts when they name every kind with a whole number, else the plan's", () => {
    expect(countsOf(pieces, null)).toEqual({ [COM]: 2, [SEM]: 0 });
    expect(countsOf(pieces, { [COM]: 1, [SEM]: 3 })).toEqual({ [COM]: 1, [SEM]: 3 });
    // Kept under a plan whose kinds changed since, or not counts at all: as planned.
    expect(countsOf(pieces, { [COM]: 4 })).toEqual({ [COM]: 2, [SEM]: 0 });
    expect(countsOf(pieces, { [COM]: 1.5, [SEM]: 0 })).toEqual({ [COM]: 2, [SEM]: 0 });
    expect(countsOf(pieces, { [COM]: MAX_PIECES + 1, [SEM]: 0 })).toEqual({ [COM]: 2, [SEM]: 0 });
    expect(piecesTotal({ [COM]: 1, [SEM]: 3 })).toBe(4);
  });

  it("keeps counts only when they differ from the plan's, and refuses what can't be this item's counts", () => {
    expect(keptCounts(pieces, null)).toBeNull();
    expect(keptCounts(pieces, undefined)).toBeNull();
    expect(keptCounts(pieces, { [COM]: 2, [SEM]: 0 })).toBeNull();
    expect(keptCounts(pieces, { [COM]: 2, [SEM]: 2 })).toEqual({ [COM]: 2, [SEM]: 2 });
    // A kind left out: as planned.
    expect(keptCounts(pieces, { [SEM]: 1 })).toEqual({ [COM]: 2, [SEM]: 1 });
    expect(keptCounts(pieces, { [COM]: 0, [SEM]: 0 })).toEqual({ [COM]: 0, [SEM]: 0 });
    for (const bad of [{ gema: 1 }, { [COM]: -1 }, { [COM]: 2.5 }, { [COM]: MAX_PIECES + 1 }, { [COM]: "3" }, [3, 0], "3", 3]) {
      expect(keptCounts(pieces, bad)).toBeUndefined();
    }
  });

  it("says the pieces in words", () => {
    expect(kindWords({ label: "Com gema" })).toBe("com gema");
    expect(piecesAmount(pieces, { [COM]: 2, [SEM]: 0 })).toBe("2 ovos com gema");
    expect(piecesAmount(pieces, { [COM]: 0, [SEM]: 1 })).toBe("1 ovo sem gema");
    expect(piecesAmount(pieces, { [COM]: 2, [SEM]: 1 })).toBe("3 ovos: 2 com gema, 1 sem gema");
    expect(piecesAmount(pieces, { [COM]: 0, [SEM]: 0 })).toBe("0 ovos");
    // One kind only: the count is all there is to say.
    expect(piecesAmount({ ...pieces, kinds: [pieces.kinds[0]] }, { [COM]: 3 })).toBe("3 ovos");
  });

  it("serves the item itself as planned, and the pieces eaten added up otherwise", () => {
    expect(servingOf(ovos, { choiceId: null, counts: null })).toBe(ovos);
    expect(servingOf(ovos, { choiceId: null, counts: { [COM]: 2, [SEM]: 0 } })).toBe(ovos);
    expect(servingOf(ovos, { choiceId: null, counts: { [COM]: 1, [SEM]: 2 } })).toEqual({
      id: "cafe-ovos",
      food: "Ovos mexidos",
      amount: "3 ovos: 1 com gema, 2 sem gema",
      measure: "sem óleo",
      grams: 116,
      kcal: 109,
      protein: 13.45,
      carbs: 0.9,
      fat: 5,
    });
    // An item without pieces ignores counts.
    expect(servingOf(tilapia, { choiceId: "almoco-atum", counts: { [COM]: 9 } })).toMatchObject({ food: "Atum em lata, escorrido" });
  });
});

describe("dayTotals", () => {
  it("adds up the eaten items only, and counts every item of the plan (an alternative is not one more)", () => {
    expect(planItems(plan.meals)).toHaveLength(5);
    expect(dayTotals(plan.meals, {})).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0, eaten: 0, items: 5 });
    const t = dayTotals(plan.meals, {
      "cafe-pao": eaten(),
      "cafe-ovos": eaten(),
      // Picked but not eaten: counts for nothing.
      "almoco-arroz": { eaten: false, choiceId: null, counts: null },
    });
    expect(t).toEqual({ kcal: 270, protein: 18.5, carbs: 23, fat: 11.5, eaten: 2, items: 5 });
  });

  it("counts an item by what filled it: the alternative's numbers on its day, the pieces eaten on theirs", () => {
    expect(dayTotals(plan.meals, { "almoco-tilapia": eaten() })).toMatchObject({ kcal: 190, protein: 39, fat: 4, eaten: 1 });
    expect(dayTotals(plan.meals, { "almoco-tilapia": eaten("almoco-atum") })).toMatchObject({ kcal: 140, protein: 31, fat: 1.2, eaten: 1 });
    // Three whole eggs and one white: 3 × 75 + 17 kcal.
    expect(dayTotals(plan.meals, { "cafe-ovos": eaten(null, { [COM]: 3, [SEM]: 1 }) })).toMatchObject({
      kcal: 242,
      protein: 22.4,
      carbs: 1.7,
      fat: 15,
      eaten: 1,
    });
  });

  it("ignores marks for ids the plan doesn't have, inherited names included", () => {
    const t = dayTotals(plan.meals, { "item-antigo": eaten() });
    expect(t).toMatchObject({ kcal: 0, eaten: 0, items: 5 });
    // A plan whose item is called "constructor" reads no Object.prototype member as its mark.
    expect(markOf({}, "constructor")).toEqual({ eaten: false, choiceId: null, counts: null });
    expect(markOf({}, "toString")).toEqual({ eaten: false, choiceId: null, counts: null });
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
    const t = dayTotals(meals, { a: eaten(), b: eaten() });
    expect([t.kcal, t.protein, t.carbs, t.fat]).toEqual([0.3, 0.3, 0.3, 0.8]);
  });

  it("planTotals: the whole plan eaten as written", () => {
    expect(planTotals(plan.meals)).toEqual({ kcal: 680, protein: 67.5, carbs: 64, fat: 16.8, eaten: 5, items: 5 });
  });
});
