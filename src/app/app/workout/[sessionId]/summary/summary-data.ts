import "server-only";
import { prisma } from "@/lib/db";
import { getWeeklyProgress } from "@/lib/data/dashboard";
import { entryWeekWasTrained, getRecentlyCompletedBlock } from "@/lib/data/program-lifecycle";
import { getWeeklyStreak } from "@/lib/data/streak-data";
import { getUpcomingPlan } from "@/lib/data/upcoming";
import { planWeek } from "@/lib/training/day-rotation";
import { countedWeeks } from "@/lib/programming/block-progress";
import type { NextLoadAdvice } from "@/lib/training/next-load";
import { groupRecordsByExercise } from "@/lib/training/personal-records-core";
import { adviceFromLastTime } from "@/lib/training/set-plan";
import { deriveGroups } from "@/lib/programming/groups";
import { NOT_BANNED } from "@/lib/social/authorization";
import { startOfWeek } from "@/lib/training/week";
import { compareWithLast, setsText, type LastTimeDelta, type LiteSet } from "./dossier";
import { correctableUntil as correctionDeadline, getSessionRirTargets, isStillEditable } from "@/lib/data/workout-session";

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
      updatedAt: true,
      durationSeconds: true,
      totalVolumeKg: true,
      totalWorkingSets: true,
      programWeek: true,
      /** Opened in an applied deload week (W-128): light on purpose. */
      isDeload: true,
      // Its sharing choices (set from the profile's defaults when it was opened).
      visibility: true,
      showDetailedLoads: true,
      caption: true,
      enrollmentId: true,
      enrollment: { select: { startedAt: true, status: true } },
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
          groupKey: true,
          substitutedFromExerciseId: true,
          substitutedFrom: { select: { namePt: true } },
          exercise: { select: { namePt: true, slug: true } },
          programExercise: { select: { progressionStrategy: true, loadIncrementKg: true, exerciseId: true } },
          sets: {
            orderBy: { setNumber: "asc" },
            select: { id: true, setType: true, isExtra: true, weightKg: true, reps: true, rir: true, isCompleted: true },
          },
        },
      },
      records: { select: { id: true, exerciseId: true, kind: true, value: true, weightKg: true, reps: true } },
      // shareToken is omitted from every row by default (lib/db.ts): asked for explicitly.
      activity: {
        select: {
          id: true,
          visibility: true,
          showDetailedLoads: true,
          caption: true,
          updatedAt: true,
          moderatedAt: true,
          shareToken: true,
        },
      },
    },
  });
  if (!session || session.userId !== userId) return null;
  if (session.status !== "COMPLETED" || !session.finishedAt) {
    return { status: session.status === "IN_PROGRESS" ? ("IN_PROGRESS" as const) : ("DISCARDED" as const) };
  }
  const finishedAt = session.finishedAt;
  // Sets can be corrected and the workout deleted for a while after it was saved (W-088).
  const saved = { finishedAt, updatedAt: session.updatedAt };
  const correctableUntil = isStillEditable(saved, now) ? correctionDeadline(saved) : null;

  const [profile, ordinal, newer, previous, completedBlock, entryWeekTrained, rirTargets, followerCount, answeredNotice] = await Promise.all([
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
    // The workout that closed its block: what comes next replaces "Próximo treino".
    session.enrollment?.status === "COMPLETED" ? getRecentlyCompletedBlock(userId, now) : Promise.resolve(null),
    // A trained entry week took week 1 of the counter; an untrained one took nothing.
    session.enrollmentId && session.enrollment
      ? entryWeekWasTrained(prisma, { id: session.enrollmentId, userId, startedAt: session.enrollment.startedAt })
      : Promise.resolve(false),
    // The RIR each exercise aimed for in its program week — what the workout screen showed.
    getSessionRirTargets(userId, session.id),
    // "Você ainda não tem seguidores" under Seguidores — counted as /u counts them (a banned account isn't one).
    prisma.follow.count({ where: { followingId: userId, follower: NOT_BANNED } }),
    // The one-time question to a PRIVATE default (D-A), once answered.
    prisma.userDismissal.findUnique({
      where: { userId_key: { userId, key: PRIVATE_DEFAULT_NOTICE } },
      select: { createdAt: true },
    }),
  ]);
  const fresh = !newer;
  const blockDone = fresh && completedBlock?.enrollmentId === session.enrollmentId ? completedBlock : null;

  // Supersets are read over every exercise of the workout, before the ones
  // with nothing done drop out (lib/programming/groups.ts).
  const groups = deriveGroups(session.exerciseLogs);
  const exercises = session.exerciseLogs
    .map((log, index) => {
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
              prescribed: { repMin: log.repMin, repMax: log.repMax, rirTarget: rirTargets.get(log.id) ?? log.rirTarget },
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
        /** Its place in a superset / circuit ("A1", "Superset A"), or null. */
        group: groups[index],
        /**
         * Swapped mid-workout (W-006): what the program asked for, whether the
         * program still asks for it — then "Usar no programa" can make the
         * swap stick — or already asks for the one done (it was made to stick).
         */
        swap: log.substitutedFromExerciseId
          ? {
              fromName: log.substitutedFrom?.namePt ?? "",
              canUseInProgram: log.programExercise?.exerciseId === log.substitutedFromExerciseId,
              inProgram: !!log.programExercise && log.programExercise.exerciseId === log.exerciseId,
            }
          : null,
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
      isDeload: session.isDeload,
      /** The program week as the block counts it (a trained entry week is 0), when the workout belongs to one. */
      countedWeek:
        session.programWeek != null && session.enrollment
          ? countedWeeks(session.programWeek, session.enrollment.startedAt, entryWeekTrained)
          : session.programWeek,
      durationWeeks: session.program?.durationWeeks ?? null,
    },
    ordinal,
    blockDone,
    fresh,
    correctableUntil,
    exercises,
    recordGroups,
    /** Every exercise here is logged for the first time: the whole workout is the baseline. */
    allBaseline: exercises.length > 0 && firstTime.size === exercises.length,
    share: shareState(session, {
      fresh,
      followerCount,
      askPrivateDefault: profile?.defaultWorkoutVisibility === "PRIVATE" && !answeredNotice,
      loadsHidden: !(profile?.showLoadsPublicly ?? false),
    }),
    next: fresh && !blockDone ? await nextUp(userId, finishedAt, now, profile) : null,
  };
}

/** The dismissal key of the summary's one-time question to a PRIVATE default (D-A). */
const PRIVATE_DEFAULT_NOTICE = "private-default-notice";

/**
 * The share block's state: how the workout is published (if at all), its
 * live share link, and whether to ask a PRIVATE default the one-time
 * question (D-A) — only on the latest workout, while it isn't out yet.
 */
function shareState(
  session: {
    visibility: "PRIVATE" | "FOLLOWERS" | "PUBLIC";
    showDetailedLoads: boolean;
    caption: string | null;
    activity: {
      id: string;
      visibility: "PRIVATE" | "FOLLOWERS" | "PUBLIC";
      showDetailedLoads: boolean;
      caption: string | null;
      updatedAt: Date;
      moderatedAt: Date | null;
      shareToken: string | null;
    } | null;
  },
  ctx: { fresh: boolean; followerCount: number; askPrivateDefault: boolean; loadsHidden: boolean },
) {
  const activity = session.activity;
  const moderated = Boolean(activity?.moderatedAt);
  return {
    published: activity
      ? {
          id: activity.id,
          visibility: activity.visibility,
          showDetailedLoads: activity.showDetailedLoads,
          caption: activity.caption,
          moderated,
        }
      : null,
    link: activity?.shareToken && !moderated ? { token: activity.shareToken, version: activity.updatedAt.getTime() } : null,
    initial: {
      visibility: activity?.visibility ?? session.visibility,
      showDetailedLoads: activity?.showDetailedLoads ?? session.showDetailedLoads,
      caption: activity?.caption ?? session.caption ?? "",
    },
    followerCount: ctx.followerCount,
    privateNotice:
      ctx.fresh && ctx.askPrivateDefault && !moderated && (activity?.visibility ?? session.visibility) === "PRIVATE"
        ? { loadsHidden: ctx.loadsHidden }
        : null,
  };
}

export type WorkoutSummary = Extract<NonNullable<Awaited<ReturnType<typeof loadWorkoutSummary>>>, { status: "COMPLETED" }>;

/**
 * For each exercise of the session, its most recent COMPLETED log finished
 * BEFORE this session (with at least one working set done) — so a summary
 * opened from the history compares with the time before it, not with later
 * workouts. A deload workout (light on purpose) is never the reference for a
 * normal one; a deload workout compares with anything. One query.
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
        AND (NOT s."isDeload" OR (SELECT c."isDeload" FROM "WorkoutSession" c WHERE c.id = ${sessionId}))
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
 * The weekly streak (lib/training/streak.ts, the app's only streak rule: weeks
 * on target in a row, deload weeks count, one free week per 8), built by the
 * same week rows as Today's.
 */
async function streakNow(userId: string, now: Date) {
  const s = await getWeeklyStreak(userId, now);
  return { current: s.current, best: s.best };
}

/**
 * This week's count and the next workout with a suggested date — what Today's
 * hero will offer on that date: Today's own rule, read through
 * getUpcomingPlan (lib/data/upcoming.ts: the entry week's target from the
 * activation day, a week that already counts through another program, the
 * user's week, next week's "continuar a sequência" default).
 */
async function nextUp(
  userId: string,
  finishedAt: Date,
  now: Date,
  profile: { daysPerWeek: number; preferredDays: number[] } | null,
) {
  const inThisWeek = finishedAt >= startOfWeek(now);
  const plan = await getUpcomingPlan(userId, now, profile);

  if (!plan.hasPlan) {
    const [weeklyCount, streak] = await Promise.all([
      getWeeklyProgress(userId),
      inThisWeek ? streakNow(userId, now) : Promise.resolve({ current: 0, best: 0 }),
    ]);
    return {
      programName: plan.enrollment?.program.name ?? null,
      week: inThisWeek ? { done: weeklyCount, target: profile?.daysPerWeek ?? 3, entry: false, streak } : null,
      day: null,
      weekComplete: false,
      date: null,
      openDaysBlocking: 0,
    };
  }

  const { enrollment, habit, rule, up, weekView, weekInput, openDayIds } = plan;
  const { days, isTrainable } = weekInput;
  const next = up.next;
  const day = next
    ? {
        id: next.day.id,
        name: next.day.name,
        exerciseCount: next.day.exercises.length,
        estimatedMinutes: next.day.estimatedMinutes,
      }
    : null;
  return {
    programName: enrollment.program.name,
    week: inThisWeek
      ? rule.alreadyCounts
        ? {
            // The week already counted through another program (the streak's row judges it).
            done: habit.streak.thisWeek.done,
            target: habit.streak.thisWeek.target,
            entry: false,
            streak: { current: habit.streak.current, best: habit.streak.best },
          }
        : {
            // Never cut to an entry week's cap: two workouts are two.
            done: Math.max(up.week.weeklyDone, rule.targetCap != null ? planWeek(weekInput).weeklyDone : 0),
            target: up.week.weeklyTarget,
            /** A program started Thursday–Sunday: its short entry week, aimed at the days from the activation day. */
            entry: weekView.kind === "entry",
            streak: { current: habit.streak.current, best: habit.streak.best },
          }
      : null,
    day,
    weekComplete: up.week.weekComplete,
    date: next ? { dayNo: next.dayNo, isToday: next.isToday, isTomorrow: next.isTomorrow } : null,
    /** Days left open that leave no day to promise (Today's "não finalizado" rows); 0 when there's a day. */
    openDaysBlocking: next ? 0 : days.filter((d) => isTrainable(d) && openDayIds.has(d.id)).length,
  };
}
