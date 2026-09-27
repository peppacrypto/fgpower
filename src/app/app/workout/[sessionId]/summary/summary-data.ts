import "server-only";
import { prisma } from "@/lib/db";
import { getActiveEnrollment, getDaysDoneThisWeek, getInProgressSessions, getWeeklyProgress } from "@/lib/data/dashboard";
import { resolveSessionDay } from "@/lib/training/day-match";
import type { NextLoadAdvice } from "@/lib/training/next-load";
import { groupRecordsByExercise } from "@/lib/training/personal-records-core";
import { adviceFromLastTime } from "@/lib/training/set-plan";
import { startOfWeek } from "@/lib/training/week";
import {
  compareWithLast,
  nextWorkout,
  setsText,
  spDayNumber,
  weekStreak,
  type LastTimeDelta,
  type LiteSet,
  type PlanDay,
} from "./dossier";

/**
 * Everything the workout summary shows, for its owner. `fresh` is whether this
 * is the user's latest finished workout: only then does the page talk about
 * what's next ("Na próxima", this week, the next workout) — opened later from
 * the history, it is a dated record that still compares with the time before.
 */
export async function loadWorkoutSummary(userId: string, sessionId: string, now: Date = new Date()) {
  const session = await prisma.workoutSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      name: true,
      status: true,
      finishedAt: true,
      durationSeconds: true,
      totalVolumeKg: true,
      totalWorkingSets: true,
      programWeek: true,
      program: { select: { progressionStrategy: true, durationWeeks: true } },
      exerciseLogs: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          exerciseId: true,
          repMin: true,
          repMax: true,
          rirTarget: true,
          prescribedSets: true,
          exercise: { select: { namePt: true, slug: true } },
          programExercise: { select: { progressionStrategy: true, loadIncrementKg: true } },
          sets: {
            orderBy: { setNumber: "asc" },
            select: { id: true, setType: true, isExtra: true, weightKg: true, reps: true, rir: true, isCompleted: true },
          },
        },
      },
      records: { select: { id: true, exerciseId: true, kind: true, value: true, weightKg: true, reps: true } },
      activity: { select: { id: true, visibility: true, showDetailedLoads: true, caption: true } },
    },
  });
  if (!session || session.userId !== userId) return null;
  if (session.status !== "COMPLETED" || !session.finishedAt) {
    return { status: session.status === "IN_PROGRESS" ? ("IN_PROGRESS" as const) : ("DISCARDED" as const) };
  }
  const finishedAt = session.finishedAt;

  const [profile, ordinal, newer, previous] = await Promise.all([
    prisma.profile.findUnique({
      where: { userId },
      select: {
        loadIncrementKg: true,
        daysPerWeek: true,
        preferredDays: true,
        defaultWorkoutVisibility: true,
        showLoadsPublicly: true,
      },
    }),
    // "Treino nº 12": finished workouts up to and including this one.
    prisma.workoutSession.count({ where: { userId, status: "COMPLETED", finishedAt: { lte: finishedAt } } }),
    prisma.workoutSession.findFirst({
      where: { userId, status: "COMPLETED", finishedAt: { gt: finishedAt }, id: { not: session.id } },
      select: { id: true },
    }),
    previousPerformances(userId, session.id),
  ]);
  const fresh = !newer;

  const exercises = session.exerciseLogs
    .map((log) => {
      const done = log.sets.filter((s) => s.isCompleted && s.setType !== "WARMUP");
      if (done.length === 0) return null;
      const prev = previous.get(log.exerciseId) ?? null;
      // "Na próxima" is the advice the workout screen will give next time: the
      // same rule (set-plan's adviceFromLastTime) on the same sets — the
      // prescribed working ones (extras are bonus), with a load increase only
      // once every prescribed set was done.
      const reference = done.filter((s) => s.setType === "WORKING" && !s.isExtra);
      const advice: NextLoadAdvice | null =
        fresh && reference.length > 0
          ? adviceFromLastTime({
              strategy: log.programExercise?.progressionStrategy ?? session.program?.progressionStrategy ?? null,
              prescribed: { repMin: log.repMin, repMax: log.repMax, rirTarget: log.rirTarget },
              lastTime: {
                sets: reference.map((s) => ({ weightKg: s.weightKg, reps: s.reps, rir: s.rir, isExtra: false })),
                prescribedSets: log.prescribedSets,
              },
              loadIncrementKg: log.programExercise?.loadIncrementKg ?? profile?.loadIncrementKg ?? 2.5,
            })
          : null;
      const delta: LastTimeDelta = compareWithLast(done, prev?.sets ?? null);
      return {
        logId: log.id,
        exerciseId: log.exerciseId,
        name: log.exercise.namePt,
        slug: log.exercise.slug,
        sets: done,
        delta,
        previousText: prev ? setsText(prev.sets) : null,
        previousAt: prev?.doneAt ?? null,
        advice,
      };
    })
    .filter((e) => e !== null);

  const order = exercises.map((e) => e.exerciseId);
  // An exercise done for the first time is a baseline, never a record — also
  // for workouts saved before that rule, whose first times still hold rows.
  const firstTime = new Set(exercises.filter((e) => e.delta.kind === "first").map((e) => e.exerciseId));
  const records = session.records.filter((r) => !firstTime.has(r.exerciseId));
  const recordGroups = groupRecordsByExercise(records, (r) => r.exerciseId, order).map((g) => {
    const ex = exercises.find((e) => e.exerciseId === g.key);
    return { exerciseId: g.key, name: ex?.name ?? "", slug: ex?.slug ?? null, records: g.records };
  });

  return {
    status: "COMPLETED" as const,
    session: {
      id: session.id,
      name: session.name,
      finishedAt,
      durationSeconds: session.durationSeconds,
      totalVolumeKg: session.totalVolumeKg,
      totalWorkingSets: session.totalWorkingSets ?? 0,
      programWeek: session.programWeek,
      durationWeeks: session.program?.durationWeeks ?? null,
    },
    ordinal,
    fresh,
    exercises,
    recordGroups,
    /** Every exercise here is logged for the first time: the whole workout is the baseline. */
    allBaseline: exercises.length > 0 && firstTime.size === exercises.length,
    share: {
      published: session.activity,
      initial: {
        visibility: session.activity?.visibility ?? profile?.defaultWorkoutVisibility ?? "PRIVATE",
        showDetailedLoads: session.activity?.showDetailedLoads ?? profile?.showLoadsPublicly ?? false,
        caption: session.activity?.caption ?? "",
      },
    },
    next: fresh ? await nextUp(userId, finishedAt, now, profile) : null,
  };
}

export type WorkoutSummary = Extract<NonNullable<Awaited<ReturnType<typeof loadWorkoutSummary>>>, { status: "COMPLETED" }>;

/**
 * For each exercise of the session, its most recent COMPLETED log finished
 * BEFORE this session (with at least one working set done) — so a summary
 * opened from the history compares with the time before it, not with later
 * workouts. One query.
 */
async function previousPerformances(userId: string, sessionId: string) {
  const rows = await prisma.$queryRaw<{ exerciseId: string; doneAt: Date; sets: LiteSet[] | string }[]>`
    WITH last AS (
      SELECT DISTINCT ON (l."exerciseId") l.id, l."exerciseId", s."finishedAt" AS "doneAt"
      FROM "WorkoutExerciseLog" l
      JOIN "WorkoutSession" s ON s.id = l."sessionId"
      WHERE l."userId" = ${userId}
        AND l."sessionId" <> ${sessionId}
        AND s.status = 'COMPLETED'
        AND s."finishedAt" < (SELECT c."finishedAt" FROM "WorkoutSession" c WHERE c.id = ${sessionId})
        AND l."exerciseId" IN (SELECT e."exerciseId" FROM "WorkoutExerciseLog" e WHERE e."sessionId" = ${sessionId})
        AND EXISTS (
          SELECT 1 FROM "SetLog" x WHERE x."exerciseLogId" = l.id AND x."isCompleted" AND x."setType" <> 'WARMUP'
        )
      ORDER BY l."exerciseId", s."finishedAt" DESC
    )
    SELECT last."exerciseId", last."doneAt",
      json_agg(
        json_build_object('weightKg', x."weightKg", 'reps', x.reps, 'isExtra', x."isExtra")
        ORDER BY x."setNumber"
      ) AS sets
    FROM last
    JOIN "SetLog" x ON x."exerciseLogId" = last.id AND x."isCompleted" AND x."setType" <> 'WARMUP'
    GROUP BY last."exerciseId", last."doneAt"`;
  const out = new Map<string, { doneAt: Date; sets: LiteSet[] }>();
  for (const r of rows) {
    const sets = typeof r.sets === "string" ? (JSON.parse(r.sets) as LiteSet[]) : r.sets;
    out.set(r.exerciseId, { doneAt: new Date(r.doneAt), sets });
  }
  return out;
}

/**
 * Weeks in a row with a finished workout (with at least one working set, as
 * the weekly counter counts them), up to this week. Reads a year back at most.
 */
async function weeksInARow(userId: string, now: Date) {
  const since = new Date(now.getTime() - 400 * 86_400_000);
  const sessions = await prisma.workoutSession.findMany({
    where: { userId, status: "COMPLETED", totalWorkingSets: { gt: 0 }, finishedAt: { gte: since, lte: now } },
    select: { finishedAt: true },
  });
  return weekStreak(
    sessions.flatMap((s) => (s.finishedAt ? [spDayNumber(s.finishedAt)] : [])),
    spDayNumber(now),
  );
}

/**
 * This week's count and the next workout with a suggested date — the day
 * Today will offer on that date (nextWorkout; read-only use of Today's loaders).
 */
async function nextUp(
  userId: string,
  finishedAt: Date,
  now: Date,
  profile: { daysPerWeek: number; preferredDays: number[] } | null,
) {
  const inThisWeek = finishedAt >= startOfWeek(now);
  const [enrollment, streak] = await Promise.all([
    getActiveEnrollment(userId),
    inThisWeek ? weeksInARow(userId, now) : Promise.resolve(0),
  ]);
  const days: (PlanDay & { exerciseCount: number })[] = (enrollment?.program.days ?? []).map((d) => ({
    id: d.id,
    dayIndex: d.dayIndex,
    name: d.name,
    exerciseCount: d.exercises.length,
    weekday: d.weekday,
    estimatedMinutes: d.estimatedMinutes,
  }));
  const hasPlan = days.some((d) => d.exerciseCount > 0);

  if (!enrollment || !hasPlan) {
    const weeklyCount = await getWeeklyProgress(userId);
    return {
      programName: enrollment?.program.name ?? null,
      week: inThisWeek ? { done: weeklyCount, target: profile?.daysPerWeek ?? 3, streak } : null,
      day: null,
      weekComplete: false,
      date: null,
      openDaysBlocking: 0,
    };
  }

  const [done, inProgress] = await Promise.all([
    getDaysDoneThisWeek(userId, enrollment.id, days),
    getInProgressSessions(userId, now),
  ]);
  // Days of this program with a workout still open (as Today's day rows map them).
  const openDayIds = new Set(
    inProgress
      .filter((s) => s.programId === enrollment.programId)
      .flatMap((s) => resolveSessionDay(s, days)?.id ?? []),
  );
  const next = nextWorkout({
    days,
    nextDayIndex: enrollment.nextDayIndex,
    daysPerWeek: enrollment.program.daysPerWeek,
    doneDayIds: done.byDayId,
    sessionCount: done.sessionCount,
    openDayIds,
    finishedAt,
    now,
    preferredDays: profile?.preferredDays ?? [],
  });
  return {
    programName: enrollment.program.name,
    week: inThisWeek ? { done: next.weeklyDone, target: next.weeklyTarget, streak } : null,
    day: next.day,
    weekComplete: next.weekComplete,
    date: next.date,
    /** Days left open that leave no day to promise (Today's "não finalizado" rows); 0 when there's a day. */
    openDaysBlocking: next.openDaysBlocking,
  };
}
