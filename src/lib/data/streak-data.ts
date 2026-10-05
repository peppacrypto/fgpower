import "server-only";
import { prisma } from "@/lib/db";
import { parseWeekTargetSnapshot } from "@/lib/training/week-target";
import {
  streakWeeksFrom,
  summarizeStreak,
  type StreakEnrollment,
  type StreakSession,
  type StreakWeekRow,
  type WeeklyStreakSummary,
} from "./streak-weeks";

export type { StreakEnrollment, StreakSession, StreakWeekRow, WeeklyStreakSummary };
export { streakWeeksFrom, summarizeStreak };

/** How far back the streak reads (a year and a bit: the longest run anyone could show). */
const LOOKBACK_DAYS = 400;

/**
 * The rows the weekly streak is built from: finished workouts with a working
 * set in the window, the enrollments they belong to (or active in it), and
 * the profile's days per week. Three small queries.
 */
export async function loadStreakInputs(userId: string, now: Date = new Date()) {
  const since = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000);
  const [sessions, enrollments, profile] = await Promise.all([
    prisma.workoutSession.findMany({
      where: { userId, status: "COMPLETED", totalWorkingSets: { gt: 0 }, finishedAt: { gte: since, lte: now } },
      orderBy: { finishedAt: "asc" },
      select: {
        id: true,
        finishedAt: true,
        enrollmentId: true,
        programDayId: true,
        programDayIndex: true,
        name: true,
        programWeek: true,
        weekTargetSnapshot: true,
      },
    }),
    prisma.programEnrollment.findMany({
      where: { userId, startedAt: { lte: now }, OR: [{ endedAt: null }, { endedAt: { gte: since } }] },
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        currentWeek: true,
        deloadMondays: true,
        program: {
          select: {
            daysPerWeek: true,
            durationWeeks: true,
            weeklyGuidance: true,
            sourceTemplate: { select: { slug: true } },
            days: { select: { id: true, dayIndex: true, name: true } },
          },
        },
      },
    }),
    prisma.profile.findUnique({ where: { userId }, select: { daysPerWeek: true } }),
  ]);
  // Count exercises per day with a query bounded to these days' ids (A-037):
  // a nested relation _count compiles to an unfiltered GROUP BY over the whole
  // UserProgramExercise table; this groupBy rides the (dayId, sortOrder) index.
  const dayIds = enrollments.flatMap((e) => e.program.days.map((d) => d.id));
  const exerciseCounts = dayIds.length
    ? await prisma.userProgramExercise.groupBy({
        by: ["dayId"],
        where: { dayId: { in: dayIds } },
        _count: { _all: true },
      })
    : [];
  const exerciseCountByDay = new Map(exerciseCounts.map((r) => [r.dayId, r._count._all]));
  return {
    sessions: sessions.flatMap((s): (StreakSession & { id: string })[] =>
      s.finishedAt ? [{ ...s, finishedAt: s.finishedAt, weekTargetSnapshot: parseWeekTargetSnapshot(s.weekTargetSnapshot) }] : [],
    ),
    enrollments: enrollments.map(
      (e): StreakEnrollment => ({
        id: e.id,
        startedAt: e.startedAt,
        endedAt: e.endedAt,
        currentWeek: e.currentWeek,
        deloadMondays: e.deloadMondays,
        program: {
          daysPerWeek: e.program.daysPerWeek,
          durationWeeks: e.program.durationWeeks,
          weeklyGuidance: e.program.weeklyGuidance,
          templateSlug: e.program.sourceTemplate?.slug ?? null,
          days: e.program.days.map((d) => ({ id: d.id, dayIndex: d.dayIndex, name: d.name, exerciseCount: exerciseCountByDay.get(d.id) ?? 0 })),
        },
      }),
    ),
    profileDaysPerWeek: profile?.daysPerWeek ?? 3,
  };
}

/**
 * The weekly streak's input (contract with the workout summary): complete
 * weeks oldest → newest and this week, as lib/training/streak's weeklyStreak
 * takes them — `weeklyStreak(weeks, thisWeek)`.
 */
export async function buildStreakWeeks(
  userId: string,
  now: Date = new Date(),
): Promise<{ weeks: StreakWeekRow[]; thisWeek: StreakWeekRow }> {
  return streakWeeksFrom({ ...(await loadStreakInputs(userId, now)), now });
}

/** The streak, the record, and where this week stands (Today's "Esta semana", the summary's streak line). */
export async function getWeeklyStreak(userId: string, now: Date = new Date()): Promise<WeeklyStreakSummary> {
  return summarizeStreak(await buildStreakWeeks(userId, now));
}
