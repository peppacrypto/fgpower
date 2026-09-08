import "server-only";
import { prisma } from "@/lib/db";

export async function listSessionsInRange(userId: string, from: Date, to: Date) {
  return prisma.workoutSession.findMany({
    where: { userId, status: "COMPLETED", finishedAt: { gte: from, lte: to } },
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

export async function listAllSessions(userId: string, page = 1, pageSize = 20) {
  const [items, total] = await Promise.all([
    prisma.workoutSession.findMany({
      where: { userId, status: "COMPLETED" },
      orderBy: { finishedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, name: true, finishedAt: true, durationSeconds: true, totalWorkingSets: true },
    }),
    prisma.workoutSession.count({ where: { userId, status: "COMPLETED" } }),
  ]);
  return { items, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
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
