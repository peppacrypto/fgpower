import "server-only";
import { prisma } from "@/lib/db";
import { startOfWeek } from "@/lib/training/week";
import { resolveSessionDay } from "@/lib/training/day-match";
import { assessOpenSession } from "@/lib/training/stale";

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
 * `stale` and `saveAs` are the workout screen's own reading of it
 * (assessOpenSession): left open — started on an earlier day or 8 h+ ago and
 * untouched for 2 h (a workout started at 23:30 and still being logged at
 * 00:05 is live) — and the day and duration "Salvar como feito em …" gives it.
 */
export async function getInProgressSessions(userId: string, now: Date = new Date()) {
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
      completedAt: true,
      updatedAt: true,
      weightKg: true,
      reps: true,
      exerciseLog: { select: { wasSkipped: true } },
    },
  });
  return sessions.map((s) => {
    const own = sets.filter((x) => x.sessionId === s.id);
    // Rows finishing will count: ✓'d, or typed with load and reps outside a skipped exercise.
    const registered = own.filter(
      (x) =>
        x.setType !== "WARMUP" &&
        (x.isCompleted || (!x.exerciseLog.wasSkipped && x.weightKg !== null && x.reps !== null && x.reps >= 1)),
    ).length;
    const state = assessOpenSession(
      s.startedAt,
      own.map((x) => ({ ...x, wasSkipped: x.exerciseLog.wasSkipped })),
      now,
    );
    return { ...s, registered, hasData: own.length > 0, stale: state.leftOpen, saveAs: state.saveAs };
  });
}

/** How long after switching programs the previous one can be restored as it was. */
export const SWITCH_UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Slack between ending the old enrollment and creating the new one in a switch. */
const SWITCH_SLACK_MS = 60 * 1000;

/**
 * The enrollment a program switch just ended, if it can still be restored: the
 * user's, ended (ABANDONED) within the undo window, the last enrollment ended,
 * and what is active now started right as it ended — i.e. it was ended by the
 * switch to what is active now: not by something older, and not an earlier
 * link of a chain (A → B → C, however fast: a leftover "?anterior=A" must not
 * bring A back over C). Shared by Today's "Voltar para …" and the restore
 * action, which re-checks it inside its transaction.
 */
export async function findUndoableSwitch(
  db: Pick<typeof prisma, "programEnrollment">,
  userId: string,
  enrollmentId: string,
  now: Date = new Date(),
) {
  const previous = await db.programEnrollment.findFirst({
    where: {
      id: enrollmentId,
      userId,
      status: "ABANDONED",
      endedAt: { gte: new Date(now.getTime() - SWITCH_UNDO_WINDOW_MS) },
    },
    include: { program: { select: { id: true, name: true, durationWeeks: true } } },
  });
  if (!previous?.endedAt) return null;
  const endedAt = previous.endedAt.getTime();
  // Sequential: `db` can be an interactive transaction (one connection).
  const endedLater = await db.programEnrollment.findFirst({
    where: { userId, id: { not: previous.id }, endedAt: { gt: previous.endedAt } },
    select: { id: true },
  });
  if (endedLater) return null;
  const active = await db.programEnrollment.findMany({
    where: { userId, status: "ACTIVE" },
    select: { id: true, programId: true, startedAt: true },
  });
  const startedWithSwitch = (e: { startedAt: Date }) => Math.abs(e.startedAt.getTime() - endedAt) <= SWITCH_SLACK_MS;
  if (active.length === 0 || active.some((e) => e.programId === previous.programId || !startedWithSwitch(e))) {
    return null;
  }
  return { previous, active };
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
