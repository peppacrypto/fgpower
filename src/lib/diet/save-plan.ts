import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { dietPlanSchema, type DietPlanInput } from "@/lib/validation/diet-plan";

/**
 * Saves a plan as the user's active one (DietPlan, one per user), replacing
 * the plan they have — checked here by dietPlanSchema whatever the caller did,
 * so nothing else reaches the table. Days already logged keep their rows: each
 * holds the option it logged, and the screens match marks to the new plan by
 * item id. No `server-only`: the one-off import script runs this under tsx
 * (scripts/one-off/2026-11-13-diet-plan.ts); the app itself never writes plans.
 */
export async function saveDietPlan(userId: string, input: DietPlanInput) {
  const plan = dietPlanSchema.parse(input);
  const data = {
    title: plan.title,
    version: plan.version ?? null,
    goal: plan.goal ?? null,
    kcal: plan.targets.kcal,
    protein: plan.targets.protein,
    carbs: plan.targets.carbs,
    fat: plan.targets.fat,
    fiber: plan.targets.fiber ?? null,
    meals: plan.meals as unknown as Prisma.InputJsonValue,
    swaps: plan.swaps,
    rules: plan.rules,
  };
  return prisma.dietPlan.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
    select: { id: true, createdAt: true, updatedAt: true },
  });
}
