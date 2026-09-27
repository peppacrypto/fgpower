import "server-only";
import { prisma } from "@/lib/db";
import { estimate1Rm } from "@/lib/training/estimated-1rm";
import { SHOWN_PR_KINDS } from "@/lib/training/personal-records-core";

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
  /** The session's heaviest set (most reps at that load). */
  bestWeightKg: number | null;
  bestReps: number | null;
  /** Best reliable e1RM among the session's sets (≤ 10 reps), not only the heaviest one's. */
  estimated1RmKg: number | null;
  sessionVolumeKg: number;
}

/** One point per finished session of the exercise, oldest first (by when the workout was done). */
export async function getExerciseHistory(userId: string, exerciseId: string) {
  const logs = await prisma.workoutExerciseLog.findMany({
    where: { userId, exerciseId, session: { status: "COMPLETED", finishedAt: { not: null } } },
    orderBy: [{ session: { finishedAt: "asc" } }, { createdAt: "asc" }],
    include: {
      sets: { where: { isCompleted: true, setType: { in: ["WORKING", "FAILURE"] } } },
      session: { select: { finishedAt: true } },
    },
  });

  const points: ExerciseHistoryPoint[] = logs
    .filter((l) => l.session.finishedAt && l.sets.length > 0)
    .map((log) => {
      const sets = log.sets.filter((s) => s.weightKg != null && s.reps != null);
      const bestSet = sets.reduce<(typeof sets)[number] | null>((best, s) => {
        const w = s.weightKg ?? 0;
        const bw = best?.weightKg ?? 0;
        if (!best || w > bw || (w === bw && (s.reps ?? 0) > (best.reps ?? 0))) return s;
        return best;
      }, null);
      const best1Rm = sets.reduce<number | null>((best, s) => {
        const est = estimate1Rm(s.weightKg ?? 0, s.reps ?? 0);
        return est.reliable && est.epleyKg != null && (best == null || est.epleyKg > best) ? est.epleyKg : best;
      }, null);
      const volume = sets.reduce((sum, s) => sum + (s.weightKg ?? 0) * (s.reps ?? 0), 0);
      return {
        date: log.session.finishedAt as Date,
        bestWeightKg: bestSet?.weightKg ?? null,
        bestReps: bestSet?.reps ?? null,
        estimated1RmKg: best1Rm,
        sessionVolumeKg: volume,
      };
    });

  return points;
}

/** The exercise's records, newest first (session-volume rows are legacy and left out). */
export async function getExercisePersonalRecords(userId: string, exerciseId: string) {
  return prisma.exercisePersonalRecord.findMany({
    where: { userId, exerciseId, kind: { in: [...SHOWN_PR_KINDS] } },
    orderBy: { achievedAt: "desc" },
    take: 30,
  });
}

export async function getExerciseNote(userId: string, exerciseId: string) {
  return prisma.exerciseUserNote.findUnique({ where: { userId_exerciseId: { userId, exerciseId } } });
}
