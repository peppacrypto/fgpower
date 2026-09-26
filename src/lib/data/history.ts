import "server-only";
import { prisma } from "@/lib/db";

/** Completed sessions finished in [from, to) — pass `monthBounds()` from lib/training/week. */
export async function listSessionsInRange(userId: string, from: Date, to: Date) {
  return prisma.workoutSession.findMany({
    where: { userId, status: "COMPLETED", finishedAt: { gte: from, lt: to } },
    orderBy: { finishedAt: "desc" },
    select: {
      id: true,
      name: true,
      finishedAt: true,
      durationSeconds: true,
      totalVolumeKg: true,
      totalWorkingSets: true,
    },
  });
}

/**
 * One page of completed sessions, newest first. `page` is clamped to
 * [1, totalPages] (a stale ?page=99 link shows the last page instead of an
 * empty list) and the page actually served is returned.
 */
export async function listAllSessions(userId: string, page = 1, pageSize = 20) {
  const total = await prisma.workoutSession.count({ where: { userId, status: "COMPLETED" } });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Number.isSafeInteger(page) ? Math.min(Math.max(page, 1), totalPages) : 1;
  const items = await prisma.workoutSession.findMany({
    where: { userId, status: "COMPLETED" },
    orderBy: [{ finishedAt: "desc" }, { id: "desc" }],
    skip: (safePage - 1) * pageSize,
    take: pageSize,
    select: { id: true, name: true, finishedAt: true, durationSeconds: true, totalWorkingSets: true },
  });
  return { items, total, page: safePage, totalPages };
}

export interface ExerciseHistoryPoint {
  date: Date;
  bestWeightKg: number | null;
  bestReps: number | null;
  estimated1RmKg: number | null;
  sessionVolumeKg: number;
}

export async function getExerciseHistory(userId: string, exerciseId: string) {
  const logs = await prisma.workoutExerciseLog.findMany({
    where: { userId, exerciseId, session: { status: "COMPLETED" } },
    orderBy: { createdAt: "asc" },
    include: {
      sets: { where: { isCompleted: true, setType: { in: ["WORKING", "FAILURE"] } } },
      session: { select: { finishedAt: true } },
    },
  });

  const points: ExerciseHistoryPoint[] = logs
    .filter((l) => l.session.finishedAt)
    .map((log) => {
      const sets = log.sets.filter((s) => s.weightKg != null && s.reps != null);
      const bestSet = sets.reduce<(typeof sets)[number] | null>((best, s) => {
        if (!best || (s.weightKg ?? 0) > (best.weightKg ?? 0)) return s;
        return best;
      }, null);
      const volume = sets.reduce((sum, s) => sum + (s.weightKg ?? 0) * (s.reps ?? 0), 0);
      return {
        date: log.session.finishedAt as Date,
        bestWeightKg: bestSet?.weightKg ?? null,
        bestReps: bestSet?.reps ?? null,
        estimated1RmKg: null, // computed client-side via estimate1Rm to keep the formula in one place
        sessionVolumeKg: volume,
      };
    });

  return points;
}

export async function getExercisePersonalRecords(userId: string, exerciseId: string) {
  return prisma.exercisePersonalRecord.findMany({
    where: { userId, exerciseId },
    orderBy: [{ kind: "asc" }, { achievedAt: "desc" }],
  });
}

export async function getExerciseNote(userId: string, exerciseId: string) {
  return prisma.exerciseUserNote.findUnique({ where: { userId_exerciseId: { userId, exerciseId } } });
}
