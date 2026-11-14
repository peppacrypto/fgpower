import { describe, expect, it } from "vitest";
import testPlan from "@/lib/diet/test-plan.json";
import { describeDietPlanIssues, dietMealsSchema, dietPlanSchema } from "./diet-plan";

/** A deep copy of the test fixture to break. */
const fixture = () => JSON.parse(JSON.stringify(testPlan)) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const issues = (input: unknown) => {
  const r = dietPlanSchema.safeParse(input);
  return r.success ? [] : describeDietPlanIssues(r.error);
};

describe("dietPlanSchema", () => {
  it("takes a whole plan: targets, meals with items, alternatives and pieces, swaps and rules", () => {
    const plan = dietPlanSchema.parse(fixture());
    expect(plan.title).toBe("Plano de teste");
    expect(plan.targets).toEqual({ kcal: 1800, protein: 150, carbs: 180, fat: 50, fiber: 30 });
    expect(plan.meals.map((m) => m.items.length)).toEqual([2, 2, 1]);
    expect(plan.meals[1].items[1].alternatives?.map((a) => a.id)).toEqual(["almoco-atum"]);
    expect(plan.swaps).toHaveLength(1);
    expect(plan.rules).toHaveLength(2);
  });

  it("needs only the essentials: no version, goal, fiber, measure, grams, label, swaps or rules", () => {
    const plan = {
      title: "Mínimo",
      targets: { kcal: 2000, protein: 150, carbs: 200, fat: 60 },
      meals: [{ id: "m1", name: "Almoço", items: [{ id: "m1-a", food: "Arroz", amount: "100 g", kcal: 130, protein: 2.5, carbs: 28, fat: 0.3 }] }],
    };
    expect(dietPlanSchema.parse(plan)).toMatchObject({ swaps: [], rules: [], targets: { kcal: 2000 } });
  });

  it("refuses a key it doesn't know, so a typo in a plan file fails the import instead of vanishing", () => {
    const p = fixture();
    p.meals[1].items[1].alternative = p.meals[1].items[1].alternatives;
    expect(issues(p).join("\n")).toMatch(/meals\.1\.items\.1/);
    const q = fixture();
    q.swap = ["x"];
    expect(issues(q)).not.toEqual([]);
  });

  it("refuses an id used twice anywhere in the plan (items key the day's marks, alternatives the choice)", () => {
    const p = fixture();
    p.meals[2].items[0].id = "cafe-pao";
    expect(issues(p)).toEqual(['meals.2.items.0.id: duplicate id "cafe-pao"']);
    const q = fixture();
    q.meals[1].items[1].alternatives[0].id = "almoco-arroz";
    expect(issues(q)).toEqual(['meals.1.items.1.alternatives.0.id: duplicate id "almoco-arroz"']);
  });

  it("refuses missing or impossible numbers and odd ids", () => {
    const p = fixture();
    delete p.meals[0].items[0].kcal;
    p.meals[0].items[1].protein = -1;
    p.targets.kcal = 1800.5;
    p.meals[2].id = "lanche da tarde";
    const found = issues(p).join("\n");
    expect(found).toMatch(/meals\.0\.items\.0\.kcal/);
    expect(found).toMatch(/meals\.0\.items\.1\.protein/);
    expect(found).toMatch(/targets\.kcal/);
    expect(found).toMatch(/meals\.2\.id/);
  });

  it("refuses an empty plan, a meal without items, blank words", () => {
    const p = fixture();
    p.meals = [];
    expect(issues(p).join("\n")).toMatch(/^meals:/m);
    const q = fixture();
    q.meals[0].items = [];
    expect(issues(q).join("\n")).toMatch(/meals\.0\.items/);
    const r = fixture();
    r.title = "   ";
    expect(issues(r).join("\n")).toMatch(/^title:/m);
  });
});

describe("an item counted in pieces (eggs with or without the yolk)", () => {
  it("takes it when its own numbers are its planned pieces'", () => {
    const ovos = dietPlanSchema.parse(fixture()).meals[0].items[1];
    expect(ovos.pieces?.kinds.map((k) => [k.label, k.planned, k.kcal])).toEqual([
      ["Com gema", 2, 75],
      ["Sem gema", 0, 17],
    ]);
    // Rounding between the item and its pieces is fine (2 × 6,25 g = 12,5 g).
    const p = fixture();
    p.meals[0].items[1].protein = 12.6;
    expect(issues(p)).toEqual([]);
  });

  it("refuses numbers that aren't the planned pieces', nothing planned, and alternatives besides", () => {
    const p = fixture();
    p.meals[0].items[1].kcal = 200;
    expect(issues(p)).toEqual(["meals.0.items.1.kcal: the planned pieces add up to 150"]);
    const q = fixture();
    q.meals[0].items[1].pieces.kinds[0].planned = 0;
    expect(issues(q)).toContain("meals.0.items.1.pieces.kinds: plan at least one piece");
    const r = fixture();
    r.meals[0].items[1].alternatives = [{ id: "cafe-tapioca", food: "Tapioca", amount: "1 unidade", kcal: 150, protein: 0, carbs: 36, fat: 0 }];
    expect(issues(r)).toEqual(["meals.0.items.1.alternatives: an item counted in pieces has no alternatives"]);
  });

  it("refuses a count that isn't whole, a kind's id used elsewhere in the plan, and a key it doesn't know", () => {
    const p = fixture();
    p.meals[0].items[1].pieces.kinds[1].planned = 1.5;
    expect(issues(p).join("\n")).toMatch(/meals\.0\.items\.1\.pieces\.kinds\.1\.planned/);
    const q = fixture();
    q.meals[0].items[1].pieces.kinds[1].id = "cafe-pao";
    expect(issues(q)).toEqual(['meals.0.items.1.pieces.kinds.1.id: duplicate id "cafe-pao"']);
    const r = fixture();
    r.meals[0].items[1].pieces.kinds[0].count = 2;
    expect(issues(r).join("\n")).toMatch(/meals\.0\.items\.1\.pieces\.kinds\.0/);
  });
});

describe("dietMealsSchema (DietPlan.meals read back)", () => {
  it("reads back what the plan stored, and nothing that isn't a list of meals", () => {
    const plan = dietPlanSchema.parse(fixture());
    expect(dietMealsSchema.parse(JSON.parse(JSON.stringify(plan.meals)))).toEqual(plan.meals);
    expect(dietMealsSchema.safeParse({ meals: plan.meals }).success).toBe(false);
    expect(dietMealsSchema.safeParse(null).success).toBe(false);
  });
});
