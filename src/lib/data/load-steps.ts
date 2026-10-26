import "server-only";
import { prisma } from "@/lib/db";

/** The user's own load steps ("Este aparelho sobe de…") for these exercises, keyed by exerciseId. */
export async function getExerciseLoadSteps(userId: string, exerciseIds: readonly string[]): Promise<Map<string, number>> {
  if (exerciseIds.length === 0) return new Map();
  const rows = await prisma.exerciseLoadStep.findMany({
    where: { userId, exerciseId: { in: [...new Set(exerciseIds)] } },
    select: { exerciseId: true, stepKg: true },
  });
  return new Map(rows.map((r) => [r.exerciseId, r.stepKg]));
}

/** The user's own load steps for a workout's exercises, keyed by exerciseId — one query. */
export async function getExerciseLoadStepsForSession(userId: string, sessionId: string): Promise<Map<string, number>> {
  const rows = await prisma.exerciseLoadStep.findMany({
    where: { userId, exercise: { exerciseLogs: { some: { sessionId } } } },
    select: { exerciseId: true, stepKg: true },
  });
  return new Map(rows.map((r) => [r.exerciseId, r.stepKg]));
}
