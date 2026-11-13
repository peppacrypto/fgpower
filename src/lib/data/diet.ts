import "server-only";
import { prisma } from "@/lib/db";
import { dietMealsSchema } from "@/lib/validation/diet-plan";
import { dayTotals, type DietMark, type DietPlan } from "@/lib/diet/plan";
import { dayNumberOf } from "@/lib/training/day-rotation";

/**
 * The owner's diet (Dieta): the plan and each day's marks — health data. Read
 * only for the owner's own screens (Dieta, the Perfil card) and the owner's
 * export; never by a public or social surface (/u, /t, the feed, OG images,
 * other people's e-mails). Every read is scoped by the caller's own user id
 * (diet-privacy.test.ts locks who may import this module).
 */

const PLAN_SELECT = {
  title: true,
  version: true,
  goal: true,
  kcal: true,
  protein: true,
  carbs: true,
  fat: true,
  fiber: true,
  meals: true,
  swaps: true,
  rules: true,
} as const;

/**
 * The user's plan, or null without one. Its meals are read back through the
 * schema they were written with; a stored plan that no longer parses (a schema
 * changed without its data) is logged and read as no plan.
 */
export async function getDietPlan(userId: string): Promise<DietPlan | null> {
  const row = await prisma.dietPlan.findUnique({ where: { userId }, select: PLAN_SELECT });
  if (!row) return null;
  const meals = dietMealsSchema.safeParse(row.meals);
  if (!meals.success) {
    console.error("DietPlan.meals does not parse", meals.error.issues.slice(0, 5));
    return null;
  }
  return {
    title: row.title,
    ...(row.version != null ? { version: row.version } : {}),
    ...(row.goal != null ? { goal: row.goal } : {}),
    targets: {
      kcal: row.kcal,
      protein: row.protein,
      carbs: row.carbs,
      fat: row.fat,
      ...(row.fiber != null ? { fiber: row.fiber } : {}),
    },
    meals: meals.data,
    swaps: row.swaps,
    rules: row.rules,
  };
}

/** One São Paulo day's marks, by item id (items without a row: not eaten, the item itself). */
export async function getDietMarks(userId: string, day: number): Promise<Record<string, DietMark>> {
  const rows = await prisma.dietLog.findMany({
    where: { userId, day },
    select: { itemId: true, eaten: true, choiceId: true },
  });
  return Object.fromEntries(rows.map((r) => [r.itemId, { eaten: r.eaten, choiceId: r.choiceId }]));
}

export interface DietGlance {
  /** Items eaten today, of the plan's. */
  eaten: number;
  items: number;
  kcal: number;
  kcalTarget: number;
}

/** Perfil's "Dieta de hoje": today's items and kcal against the plan; null without a plan. */
export async function getDietGlance(userId: string, now: Date = new Date()): Promise<DietGlance | null> {
  const [plan, marks] = await Promise.all([getDietPlan(userId), getDietMarks(userId, dayNumberOf(now))]);
  if (!plan) return null;
  const totals = dayTotals(plan.meals, marks);
  return { eaten: totals.eaten, items: totals.items, kcal: totals.kcal, kcalTarget: plan.targets.kcal };
}
