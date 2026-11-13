import { z } from "zod";
import type { DietMeal, DietPlan } from "@/lib/diet/plan";

/**
 * A diet plan (Dieta): what scripts/one-off/2026-11-13-diet-plan.ts accepts,
 * and what the app reads DietPlan.meals back with — one schema for both, so a
 * stored plan always has the shape the screens expect. A plain module (no
 * server-only: the import script runs it under tsx); client screens import the
 * zod-free lib/diet/plan instead (A-089). Unknown keys are refused, so a typo
 * in a plan file ("alternative") fails the import instead of vanishing.
 */

/** A plan's own id ("m2-frango"): what a day's marks are keyed by. */
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,47}$/, "use 1–48 letters, digits, - or _ (starting with a letter or digit)");
const text = (max: number) => z.string().trim().min(1).max(max);
/** Grams of a macro in one item. */
const macro = z.number().min(0).max(1000);

const optionShape = {
  id,
  food: text(120),
  label: text(32).optional(),
  amount: text(60),
  measure: text(80).optional(),
  grams: z.number().min(0).max(5000).optional(),
  kcal: z.number().min(0).max(5000),
  protein: macro,
  carbs: macro,
  fat: macro,
};

export const dietOptionSchema = z.strictObject(optionShape);

export const dietItemSchema = z.strictObject({
  ...optionShape,
  alternatives: z.array(dietOptionSchema).min(1).max(6).optional(),
});

export const dietMealSchema = z.strictObject({
  id,
  name: text(60),
  items: z.array(dietItemSchema).min(1).max(40),
});

/** Every id (meals, items, alternatives) at most once: an item's id keys its marks, an alternative's the choice. */
function uniqueIds(meals: readonly z.output<typeof dietMealSchema>[], ctx: z.RefinementCtx, base: (string | number)[]) {
  const seen = new Set<string>();
  const check = (value: string, path: (string | number)[]) => {
    if (seen.has(value)) ctx.addIssue({ code: "custom", path: [...base, ...path], message: `duplicate id "${value}"` });
    seen.add(value);
  };
  meals.forEach((meal, m) => {
    check(meal.id, [m, "id"]);
    meal.items.forEach((item, i) => {
      check(item.id, [m, "items", i, "id"]);
      item.alternatives?.forEach((alt, a) => check(alt.id, [m, "items", i, "alternatives", a, "id"]));
    });
  });
}

/** The meals as stored in DietPlan.meals (read back on every load). */
export const dietMealsSchema = z
  .array(dietMealSchema)
  .min(1)
  .max(12)
  .superRefine((meals, ctx) => uniqueIds(meals, ctx, []));

export const dietTargetsSchema = z.strictObject({
  kcal: z.number().int().min(500).max(10_000),
  protein: z.number().min(0).max(1000),
  carbs: z.number().min(0).max(2000),
  fat: z.number().min(0).max(1000),
  fiber: z.number().min(0).max(300).optional(),
});

/** A whole plan file. */
export const dietPlanSchema = z.strictObject({
  title: text(120),
  version: text(40).optional(),
  goal: text(400).optional(),
  targets: dietTargetsSchema,
  meals: dietMealsSchema,
  swaps: z.array(text(400)).max(40).default([]),
  rules: z.array(text(400)).max(40).default([]),
});

export type DietPlanInput = z.input<typeof dietPlanSchema>;

/** The issues of a plan that doesn't parse, one line each ("meals.1.items.0.kcal: Too big…"). */
export function describeDietPlanIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.length > 0 ? issue.path.join(".") : "(plan)"}: ${issue.message}`);
}

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
/** Compile-time guards: the schemas parse to exactly lib/diet/plan's types. */
export type DietPlanInSync = Assert<Equal<z.output<typeof dietPlanSchema>, DietPlan>>;
export type DietMealsInSync = Assert<Equal<z.output<typeof dietMealsSchema>, DietMeal[]>>;
