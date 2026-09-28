import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { startOfWeek } from "@/lib/training/week";
import { resolveSessionDay } from "@/lib/training/day-match";
import { assessOpenSession } from "@/lib/training/stale";
import { dayNumberOf, mondayOf, weekStartChoice } from "@/lib/training/day-rotation";
import { isPartialEntryWeek } from "@/lib/training/program-calendar";
import { layOutWeek } from "@/lib/programming/schedule";
import { loadStreakInputs } from "./streak-data";
import { entryWeekTrained as entryWeekHadWorkout, streakWeeksFrom, summarizeStreak } from "./streak-weeks";

/**
 * The user's active enrollment with its program's days. Each day's weekday
 * is the user's week as it stands — laid out from the profile's preferred
 * days now (programming/schedule layOutWeek, the rule activation writes onto
 * UserProgramDay.weekday) — so changing the training days in the settings
 * moves Today's schedule and the summary's next date at once.
 */
export const getActiveEnrollment = cache(async (userId: string) => {
  const enrollment = await prisma.programEnrollment.findFirst({
    where: { userId, status: "ACTIVE" },
    include: {
      user: { select: { profile: { select: { preferredDays: true } } } },
      program: {
        include: {
          // The GD series position and its test week (lib/training/week-guidance).
          sourceTemplate: { select: { slug: true } },
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
  if (!enrollment) return null;
  const { user, ...rest } = enrollment;
  const layout = layOutWeek(rest.program.days, rest.program.daysPerWeek, user.profile?.preferredDays ?? []);
  return {
    ...rest,
    program: { ...rest.program, days: rest.program.days.map((d, i) => ({ ...d, weekday: layout.weekdays[i] ?? null })) },
  };
});

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

/** Which record leads an exercise's row when one workout broke several. */
const PR_PRIORITY: Record<string, number> = { MAX_WEIGHT: 0, ESTIMATED_1RM: 1, MAX_REPS_AT_WEIGHT: 2 };

/**
 * Today's "Recordes recentes": one row per exercise (its most recent
 * record-breaking workout), newest first. A workout often breaks several
 * records of one exercise at once — load, estimated 1RM, reps — which used to
 * fill all three rows with the same exercise; they now share one row, led by
 * the load record, with `kinds` listing them all. Session-volume records are
 * not shown as PRs.
 */
export async function getRecentPersonalRecords(userId: string, limit = 3) {
  const rows = await prisma.exercisePersonalRecord.findMany({
    where: { userId, kind: { not: "SESSION_VOLUME" } },
    orderBy: { achievedAt: "desc" },
    // several records per exercise per workout: read enough to find `limit` exercises
    take: limit * 12,
    include: { exercise: { select: { namePt: true, slug: true } } },
  });
  const byExercise = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byExercise.get(r.exerciseId);
    if (!list) {
      if (byExercise.size < limit) byExercise.set(r.exerciseId, [r]);
    } else if (r.sessionId !== null && r.sessionId === list[0].sessionId) {
      list.push(r);
    }
  }
  return [...byExercise.values()].map((list) => {
    const ordered = [...list].sort((a, b) => (PR_PRIORITY[a.kind] ?? 9) - (PR_PRIORITY[b.kind] ?? 9));
    return { ...ordered[0], kinds: [...new Set(ordered.map((r) => r.kind))] };
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
    // The last time anything was typed or ✓'d in it (Today's resume after the app was killed, W-097).
    const lastActivityAt = own.reduce<Date | null>((latest, x) => {
      const t = x.completedAt && x.completedAt > x.updatedAt ? x.completedAt : x.updatedAt;
      return !latest || t > latest ? t : latest;
    }, null);
    return { ...s, registered, hasData: own.length > 0, stale: state.leftOpen, saveAs: state.saveAs, lastActivityAt };
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
    select: { id: true, programId: true, startedAt: true, updatedAt: true },
  });
  // Started by the switch — or reactivated by it ("Retomar da semana N" resumes an older enrollment).
  const startedWithSwitch = (e: { startedAt: Date; updatedAt: Date }) =>
    Math.abs(e.startedAt.getTime() - endedAt) <= SWITCH_SLACK_MS ||
    Math.abs(e.updatedAt.getTime() - endedAt) <= SWITCH_SLACK_MS;
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

export type ActiveEnrollment = NonNullable<Awaited<ReturnType<typeof getActiveEnrollment>>>;

/** Days since the last workout from which Today welcomes the user back (W-053). */
export const WELCOME_BACK_AFTER_DAYS = 10;

/**
 * Everything Today reads about the user's habit, from one read of their
 * recent workouts (the weekly streak's rows, lib/data/streak-data):
 *
 * - the last workout (the masthead's "ÚLTIMO TREINO · … · HÁ 5 DIAS"),
 * - the weekly streak and where this week stands,
 * - the days trained this week (the week strip),
 * - for the active program: whether it was trained before this week (the
 *   program week moves on with this week's first workout), whether its
 *   Thursday–Sunday entry week had a workout, last week's days and the real
 *   weekly frequency — and from them how this week starts (weekStart: the
 *   days left over, continue or start over, W-089) and how next week will
 *   (nextWeekCarryOver), the one rule for Today's hero and the workout
 *   summary's "Próximo treino" (day-rotation weekStartChoice).
 */
export async function getTodayHabit(userId: string, enrollment: ActiveEnrollment | null, now: Date = new Date()) {
  const [inputs, finishedWorkouts] = await Promise.all([
    loadStreakInputs(userId, now),
    prisma.workoutSession.count({ where: { userId, status: "COMPLETED" } }),
  ]);
  const rows = streakWeeksFrom({ ...inputs, now });
  const streak = summarizeStreak(rows);
  const todayNo = dayNumberOf(now);
  const thisMonday = mondayOf(todayNo);
  const last = inputs.sessions[inputs.sessions.length - 1] ?? null;
  const doneDayNos = inputs.sessions.map((s) => dayNumberOf(s.finishedAt)).filter((d) => d >= thisMonday);

  let program = null;
  if (enrollment) {
    const days = enrollment.program.days;
    const own = inputs.sessions.filter((s) => s.enrollmentId === enrollment.id);
    const mondayOfSession = (s: { finishedAt: Date }) => mondayOf(dayNumberOf(s.finishedAt));
    const dayIdOf = (s: (typeof own)[number]) => resolveSessionDay(s, days)?.id ?? null;
    const entryMonday = isPartialEntryWeek(enrollment.startedAt) ? mondayOf(dayNumberOf(enrollment.startedAt)) : null;
    const lastWeekSessions = own.filter((s) => mondayOfSession(s) === thisMonday - 7);
    const thisWeekSessions = own.filter((s) => mondayOfSession(s) === thisMonday);
    const daySet = (list: typeof own) => new Set(list.map(dayIdOf).filter((id): id is string => id != null));
    const lastWeekDays = daySet(lastWeekSessions);
    // Distinct days per complete week with a workout (the entry week aside), newest first.
    const byWeek = new Map<number, Set<string>>();
    for (const s of own) {
      const m = mondayOfSession(s);
      if (m >= thisMonday || m === entryMonday) continue;
      const set = byWeek.get(m) ?? new Set<string>();
      set.add(dayIdOf(s) ?? `name:${s.name}`);
      byWeek.set(m, set);
    }
    const recentWeeklyDays = [...byWeek.entries()].sort((a, b) => b[0] - a[0]).map(([, set]) => set.size);
    const thisWeekDays = new Set(thisWeekSessions.map((s) => dayIdOf(s) ?? `name:${s.name}`)).size;
    /** A week's close for weekStartChoice: its days, count, and its latest workout (sessions are oldest first). */
    const weekClose = (list: typeof own, entry: boolean) => {
      const latest = list[list.length - 1];
      return {
        doneDayIds: daySet(list),
        sessionCount: list.length,
        entry,
        lastDayId: latest ? dayIdOf(latest) : null,
        lastDoneNo: latest ? dayNumberOf(latest.finishedAt) : null,
      };
    };
    const rotation = {
      days,
      isTrainable: (d: (typeof days)[number]) => d.exercises.length > 0,
      nextDayIndex: enrollment.nextDayIndex,
      daysPerWeek: enrollment.program.daysPerWeek,
    };
    // A program started this week had no last week: it starts from its first day.
    const startedThisWeek = mondayOf(dayNumberOf(enrollment.startedAt)) >= thisMonday;
    const lastWeek = startedThisWeek ? null : weekClose(lastWeekSessions, entryMonday === thisMonday - 7);

    program = {
      trainedBefore: own.some((s) => mondayOfSession(s) < thisMonday) || enrollment.completedSessions > own.length,
      entryWeekTrained: entryWeekHadWorkout(enrollment, inputs.sessions),
      lastWeek: lastWeek ? { doneDayIds: lastWeekDays, sessionCount: lastWeek.sessionCount, entry: lastWeek.entry } : null,
      recentWeeklyDays,
      thisWeekDays,
      /**
       * This week's start after one that stopped mid-plan (W-089): the days
       * left over and the default ("Continuar a sequência" / "Recomeçar").
       */
      weekStart: weekStartChoice({
        ...rotation,
        sessionCount: thisWeekSessions.length,
        lastWeek,
        mondayNo: thisMonday,
        recentWeeklyDays,
      }),
      /**
       * Next week's start, as Today will judge it then — what a date promised
       * into next week (Today's hero, the summary's "Próximo treino") must
       * follow: true when it will continue this week's sequence.
       */
      nextWeekCarryOver:
        thisWeekSessions.length > 0 &&
        weekStartChoice({
          ...rotation,
          sessionCount: 0,
          lastWeek: weekClose(thisWeekSessions, entryMonday === thisMonday),
          mondayNo: thisMonday + 7,
          recentWeeklyDays: entryMonday === thisMonday ? recentWeeklyDays : [thisWeekDays, ...recentWeeklyDays],
        })?.byDefault === "continue",
    };
  }

  return {
    lastSession: last ? { id: last.id, name: last.name, finishedAt: last.finishedAt } : null,
    /** Finished workouts ever (the install card's cue). */
    finishedWorkouts,
    streak,
    doneDayNos,
    program,
  };
}

/**
 * The weekly volume references of docs/PROGRAMMING_RULES.md §1 (the program
 * analysis's own, lib/programming/rules.ts): a muscle is low under 4
 * fractional sets (direct sets plus half of every set where it's a
 * secondary mover) when it has direct work, high over 28 direct sets.
 */
export const LOW_WEEKLY_SETS = 4;
export const HIGH_WEEKLY_DIRECT_SETS = 28;
export const SECONDARY_SET_CREDIT = 0.5;

/**
 * Last week, closed out on Monday and Tuesday (W-129): the records set in its
 * workouts (dated by the workout, not by when it was saved: a workout left
 * open and saved later as done on its own day counts in that week) and the
 * working sets per muscle — direct (the muscle as a primary mover) and
 * fractional (plus half a set where it's a secondary one), the units
 * docs/PROGRAMMING_RULES.md judges volume in. Two small queries over one week.
 */
export async function getLastWeekReview(userId: string, now: Date = new Date()) {
  const thisWeekStart = startOfWeek(now);
  const lastWeekStart = startOfWeek(new Date(thisWeekStart.getTime() - 1));
  const lastWeek = { gte: lastWeekStart, lt: thisWeekStart };
  const [records, muscles] = await Promise.all([
    prisma.exercisePersonalRecord.findMany({
      where: {
        userId,
        kind: { not: "SESSION_VOLUME" },
        OR: [{ session: { finishedAt: lastWeek } }, { sessionId: null, achievedAt: lastWeek }],
      },
      orderBy: { achievedAt: "asc" },
      select: { exerciseId: true, exercise: { select: { namePt: true, slug: true } } },
    }),
    prisma.$queryRaw<{ muscle: string; direct: bigint | number; secondary: bigint | number }[]>`
      SELECT m."namePt" AS muscle,
        count(*) FILTER (WHERE em.role = 'PRIMARY') AS direct,
        count(*) FILTER (WHERE em.role = 'SECONDARY') AS secondary
      FROM "SetLog" x
      JOIN "WorkoutSession" s ON s.id = x."sessionId"
      JOIN "ExerciseMuscle" em ON em."exerciseId" = x."exerciseId" AND em.role IN ('PRIMARY', 'SECONDARY')
      JOIN "Muscle" m ON m.id = em."muscleId"
      WHERE x."userId" = ${userId}
        AND s."userId" = ${userId}
        AND s.status = 'COMPLETED'
        AND s."finishedAt" >= ${lastWeekStart} AND s."finishedAt" < ${thisWeekStart}
        AND x."isCompleted" AND x."setType" <> 'WARMUP'
      GROUP BY m."namePt"`,
  ]);
  const exercises = new Map<string, { namePt: string; slug: string }>();
  for (const r of records) if (!exercises.has(r.exerciseId)) exercises.set(r.exerciseId, r.exercise);
  return {
    /** Exercises with a record last week (one entry each). */
    recordExercises: [...exercises.values()],
    /** Per muscle, most volume first: `sets` fractional, `direct` as a primary mover. */
    muscles: muscles
      .map((m) => {
        const direct = Number(m.direct);
        const sets = direct + Number(m.secondary) * SECONDARY_SET_CREDIT;
        return {
          name: m.muscle,
          sets,
          direct,
          low: direct > 0 && sets < LOW_WEEKLY_SETS,
          high: direct > HIGH_WEEKLY_DIRECT_SETS,
        };
      })
      .sort((a, b) => b.sets - a.sets || a.name.localeCompare(b.name, "pt-BR")),
  };
}
