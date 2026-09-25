import "server-only";
import { prisma } from "@/lib/db";
import { startOfWeek } from "@/lib/training/week";
import { resolveSessionDay } from "@/lib/training/day-match";

export async function getActiveEnrollment(userId: string) {
  return prisma.programEnrollment.findFirst({
    where: { userId, status: "ACTIVE" },
    include: {
      program: {
        include: {
          days: {
            orderBy: { dayIndex: "asc" },
            include: {
              exercises: {
                orderBy: { sortOrder: "asc" },
                include: { exercise: { select: { id: true, namePt: true, slug: true, media: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true } } } } },
              },
            },
          },
        },
      },
    },
    orderBy: { startedAt: "desc" },
  });
}

export async function getRecentSessions(userId: string, limit = 5) {
  return prisma.workoutSession.findMany({
    where: { userId, status: "COMPLETED" },
    orderBy: { finishedAt: "desc" },
    take: limit,
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

export async function getWeeklyProgress(userId: string) {
  const count = await prisma.workoutSession.count({
    where: { userId, status: "COMPLETED", finishedAt: { gte: startOfWeek() }, totalWorkingSets: { gt: 0 } },
  });
  return count;
}

export async function getRecentPersonalRecords(userId: string, limit = 3) {
  return prisma.exercisePersonalRecord.findMany({
    where: { userId },
    orderBy: { achievedAt: "desc" },
    take: limit,
    include: { exercise: { select: { namePt: true, slug: true } } },
  });
}

/**
 * Every workout the user has in progress (normally at most one — starting a
 * day resumes or blocks — but older data can hold several), newest first.
 * `registered` counts working sets that finishing will save (✓'d, or typed
 * with load and reps); `hasData` is whether anything at all was entered.
 */
export async function getInProgressSessions(userId: string) {
  const sessions = await prisma.workoutSession.findMany({
    where: { userId, status: "IN_PROGRESS" },
    orderBy: { startedAt: "desc" },
    select: { id: true, name: true, startedAt: true, programId: true, programDayId: true, programDayIndex: true },
  });
  if (sessions.length === 0) return [];
  // Count only these sessions' sets (SetLog(sessionId) index) — a filtered
  // relation _count would aggregate the whole table.
  const sets = await prisma.setLog.findMany({
    where: {
      sessionId: { in: sessions.map((s) => s.id) },
      OR: [{ isCompleted: true }, { weightKg: { not: null } }, { reps: { not: null } }],
    },
    select: {
      sessionId: true,
      setType: true,
      isCompleted: true,
      weightKg: true,
      reps: true,
      exerciseLog: { select: { wasSkipped: true } },
    },
  });
  return sessions.map((s) => {
    const own = sets.filter((x) => x.sessionId === s.id);
    const registered = own.filter(
      (x) =>
        x.setType !== "WARMUP" &&
        (x.isCompleted || (!x.exerciseLog.wasSkipped && x.weightKg !== null && x.reps !== null && x.reps >= 1)),
    ).length;
    return { ...s, registered, hasData: own.length > 0 };
  });
}

/**
 * The program days already trained this week (Monday-start, São Paulo time,
 * same window as the weekly counter), mapped to their latest finished session
 * — so a done day shows "Ver" instead of a bare "Iniciar" that would open a
 * blank copy of it. Sessions finished without any working set don't count.
 */
export async function getDaysDoneThisWeek(
  userId: string,
  enrollmentId: string,
  days: { id: string; dayIndex: number; name: string }[],
) {
  const sessions = await prisma.workoutSession.findMany({
    where: {
      userId,
      enrollmentId,
      status: "COMPLETED",
      finishedAt: { gte: startOfWeek() },
      totalWorkingSets: { gt: 0 },
    },
    orderBy: { finishedAt: "desc" },
    select: { id: true, name: true, programDayId: true, programDayIndex: true },
  });
  const byDayId = new Map<string, string>();
  for (const s of sessions) {
    const day = resolveSessionDay(s, days);
    if (day && !byDayId.has(day.id)) byDayId.set(day.id, s.id);
  }
  return { byDayId, sessionCount: sessions.length };
}
