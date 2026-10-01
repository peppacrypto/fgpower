import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { SHOWN_PR_KINDS } from "@/lib/training/personal-records-core";
import { isBodyweightEquipment, isTimedHold } from "@/lib/training/set-plan";
import { COUNTED_SET, SESSION_PERF_COLUMNS, toSessionPerf, type SessionPerfRow } from "./history";
import { loadStreakInputs, streakWeeksFrom } from "./streak-data";
import { spMondayNo } from "./sql";
import { dayNumberOf, mondayOf } from "@/lib/training/day-rotation";
import { VOLUME_MUSCLES } from "@/lib/programming/exercise-facets";
import {
  dateOfDayNumber,
  periodStartDate,
  type MuscleWeekRow,
  type ProgressPeriod,
  type SessionPerf,
  type WeekRow,
} from "./progress-core";

export { consistencyOf, dateOfDayNumber, periodStartDate, type ProgressPeriod, type WeekRow } from "./progress-core";

const PERIOD_VALUES: ProgressPeriod[] = ["4w", "8w", "3m", "6m", "1y", "all"];

/** ?period= as a known period (anything else → `fallback`). */
export function parsePeriod(value: unknown, fallback: ProgressPeriod): ProgressPeriod {
  return typeof value === "string" && (PERIOD_VALUES as string[]).includes(value) ? (value as ProgressPeriod) : fallback;
}

/**
 * Progress's counts for a period (from periodStartDate: the Monday opening
 * the weeks "semanas na meta" reads, so the tiles never cover two spans).
 * `countedSince` is where the workouts count really starts: the period's
 * Monday — or, for "all", the Monday of the first workout's week (the weeks
 * on target only reach 400 days back, so past that the two tiles say so).
 */
export async function getProgressSummary(userId: string, period: ProgressPeriod, now: Date = new Date()) {
  const start = periodStartDate(period, now);
  // A workout counts once it has a working set (legacy empty ones don't — the streak's rule).
  const where = {
    userId,
    status: "COMPLETED" as const,
    totalWorkingSets: { gt: 0 },
    ...(start ? { finishedAt: { gte: start } } : {}),
  };

  const [sessionCount, firstWorkout, prRows, activeEnrollment] = await Promise.all([
    prisma.workoutSession.count({ where }),
    start
      ? null
      : prisma.workoutSession.findFirst({
          where: { ...where, finishedAt: { not: null } },
          orderBy: { finishedAt: "asc" },
          select: { finishedAt: true },
        }),
    prisma.exercisePersonalRecord.findMany({
      where: {
        userId,
        kind: { in: [...SHOWN_PR_KINDS] },
        ...(start ? { achievedAt: { gte: start } } : {}),
      },
      orderBy: { achievedAt: "desc" },
      take: 60,
      select: {
        id: true,
        exerciseId: true,
        sessionId: true,
        kind: true,
        value: true,
        weightKg: true,
        reps: true,
        achievedAt: true,
        exercise: { select: { namePt: true, slug: true } },
      },
    }),
    prisma.programEnrollment.findFirst({
      where: { userId, status: "ACTIVE" },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        programId: true,
        startedAt: true,
        currentWeek: true,
        plannedSessions: true,
        program: { select: { name: true, durationWeeks: true, daysPerWeek: true, _count: { select: { days: true } } } },
      },
    }),
  ]);

  const firstAt = firstWorkout?.finishedAt ?? null;
  const countedSince = start ?? (firstAt ? dateOfDayNumber(mondayOf(dayNumberOf(firstAt))) : null);
  return { sessionCount, countedSince, recentPrs: latestRecordsPerExercise(prRows, 8), activeEnrollment };
}

/**
 * One entry per exercise, most recent first: the records it set in its latest
 * record-setting workout (weight, e1RM, reps together, in display order) —
 * never three rows for the same lift pushing every other exercise off the list.
 */
function latestRecordsPerExercise<
  R extends {
    exerciseId: string;
    sessionId: string | null;
    kind: string;
    achievedAt: Date;
    exercise: { namePt: string; slug: string };
  },
>(rows: R[], limit: number) {
  const out: { exerciseId: string; namePt: string; slug: string; achievedAt: Date; records: R[] }[] = [];
  for (const r of rows) {
    const entry = out.find((e) => e.exerciseId === r.exerciseId);
    if (!entry) {
      if (out.length < limit) {
        const { namePt, slug } = r.exercise;
        out.push({ exerciseId: r.exerciseId, namePt, slug, achievedAt: r.achievedAt, records: [r] });
      }
    } else if (
      r.sessionId !== null &&
      entry.records[0].sessionId === r.sessionId &&
      !entry.records.some((x) => x.kind === r.kind)
    ) {
      entry.records.push(r);
    }
  }
  const rank = (kind: string) => (SHOWN_PR_KINDS as readonly string[]).indexOf(kind);
  for (const e of out) e.records.sort((a, b) => rank(a.kind) - rank(b.kind));
  return out;
}

// ---------------------------------------------------------------------------
// Per-exercise series
// ---------------------------------------------------------------------------

export interface ExerciseSeries {
  exerciseId: string;
  namePt: string;
  slug: string;
  bodyweight: boolean;
  timed: boolean;
  /** Sessions of the exercise in the window. */
  sessionCount: number;
  /** The first session in the window. */
  first: SessionPerf;
  /** The latest sessions (up to `recent`), oldest first — the last one is the latest. */
  recent: SessionPerf[];
}

/**
 * Every exercise trained in the window (since `since`, or ever) with its first
 * session and its latest few — aggregated in SQL (a session's sets folded into
 * one row, window functions keeping only those rows), so a two-year history
 * costs the same few rows per exercise as a two-week one.
 */
export async function getExerciseSeries(
  userId: string,
  opts: { since: Date | null; recent?: number; minSessions?: number },
): Promise<ExerciseSeries[]> {
  const recent = opts.recent ?? 12;
  const minSessions = opts.minSessions ?? 1;
  const rows = await prisma.$queryRaw<
    (SessionPerfRow & {
      exerciseId: string;
      fromStart: number;
      sessionCount: number;
      namePt: string;
      slug: string;
      equipmentCategory: string | null;
    })[]
  >`
    WITH per_session AS (
      SELECT l."exerciseId", s.id AS "sessionId", s."finishedAt" AS date, ${SESSION_PERF_COLUMNS}
      FROM "WorkoutExerciseLog" l
      JOIN "WorkoutSession" s ON s.id = l."sessionId"
      JOIN "SetLog" x ON x."exerciseLogId" = l.id AND x."userId" = ${userId}
      WHERE l."userId" = ${userId}
        AND s.status = 'COMPLETED'
        AND s."finishedAt" IS NOT NULL
        ${opts.since ? Prisma.sql`AND s."finishedAt" >= ${opts.since}` : Prisma.empty}
        AND ${COUNTED_SET}
      GROUP BY l."exerciseId", s.id, s."finishedAt"
    ), ranked AS (
      SELECT p.*,
        ROW_NUMBER() OVER (PARTITION BY p."exerciseId" ORDER BY p.date ASC, p."sessionId" ASC)::int AS "fromStart",
        ROW_NUMBER() OVER (PARTITION BY p."exerciseId" ORDER BY p.date DESC, p."sessionId" DESC)::int AS "fromEnd",
        COUNT(*) OVER (PARTITION BY p."exerciseId")::int AS "sessionCount"
      FROM per_session p
    )
    SELECT r.*, e."namePt", e.slug, q.category::text AS "equipmentCategory"
    FROM ranked r
    JOIN "Exercise" e ON e.id = r."exerciseId"
    LEFT JOIN "Equipment" q ON q.id = e."equipmentId"
    WHERE r."sessionCount" >= ${minSessions} AND (r."fromStart" = 1 OR r."fromEnd" <= ${recent})
    ORDER BY r."exerciseId", r.date ASC, r."sessionId" ASC`;

  const byExercise = new Map<string, ExerciseSeries>();
  for (const r of rows) {
    const perf = toSessionPerf(r);
    let entry = byExercise.get(r.exerciseId);
    if (!entry) {
      entry = {
        exerciseId: r.exerciseId,
        namePt: r.namePt,
        slug: r.slug,
        bodyweight: isBodyweightEquipment(r.equipmentCategory),
        timed: isTimedHold({ slug: r.slug }),
        sessionCount: r.sessionCount,
        first: perf,
        recent: [],
      };
      byExercise.set(r.exerciseId, entry);
    }
    if (r.fromStart === 1) entry.first = perf;
    // The first session is also one of the latest when there are few.
    if (r.fromStart !== 1 || r.sessionCount <= recent) entry.recent.push(perf);
  }
  return [...byExercise.values()];
}

// ---------------------------------------------------------------------------
// Weeks on target (consistency, history week marks)
// ---------------------------------------------------------------------------

/**
 * The weeks as the weekly streak reads them (lib/data/streak-data — one rule
 * for Today, the workout summary and here): São Paulo Monday-start weeks up to
 * the one holding `until`, each with its target (the program's, capped in a
 * Thursday–Sunday entry week; else the profile's days per week), the workouts
 * that count toward it, and whether it counts (met, or a planned deload week
 * with any workout — `deload` says which). `monday` is the week's São Paulo
 * day number (day-rotation). `days` are the Monday-first offsets (0–6) of
 * the days with a counted workout ("Treinos por semana"'s day grid).
 */
export async function getWeekRows(userId: string, until: Date = new Date()): Promise<WeekRow[]> {
  const inputs = await loadStreakInputs(userId, until);
  const { weeks, thisWeek } = streakWeeksFrom({ ...inputs, now: until });
  const trainedDays = new Map<number, Set<number>>();
  for (const s of inputs.sessions) {
    const day = dayNumberOf(s.finishedAt);
    const monday = mondayOf(day);
    trainedDays.set(monday, (trainedDays.get(monday) ?? new Set()).add(day - monday));
  }
  const rows = [...weeks, thisWeek];
  return rows.map((w, i) => ({
    days: [...(trainedDays.get(w.monday) ?? [])].sort((a, b) => a - b),
    monday: w.monday,
    enrollmentId: w.enrollmentId,
    done: w.done,
    target: w.target,
    met: w.met || (w.deload === true && w.trained === true),
    deload: w.deload === true,
    current: i === rows.length - 1,
    trained: w.trained === true,
    // A Thursday–Sunday entry week (lib/training/streak): counts when met, never against.
    neutral: w.neutral === true,
  }));
}

// ---------------------------------------------------------------------------
// Sets per muscle, per week (W-085)
// ---------------------------------------------------------------------------

/**
 * Working sets per muscle group (the builder's 10, VOLUME_MUSCLES) in each
 * São Paulo week since `since`: a completed set that isn't a warm-up counts
 * once per group — 1 where the exercise trains it directly, 0.5 where it
 * only assists (an exercise primary for two muscles of one group, lats and
 * middle back, counts once). Stretches and cardio don't count
 * (countsAsVolume), nor exercises without muscles. One aggregate query.
 */
export async function getMuscleWeeks(userId: string, since: Date): Promise<MuscleWeekRow[]> {
  const pairs = VOLUME_MUSCLES.flatMap((m) => m.muscleIds.map((id) => Prisma.sql`(${m.key}::text, ${id}::text)`));
  const rows = await prisma.$queryRaw<{ monday: number; key: string; sets: number; direct: number }[]>`
    WITH groups(key, muscle_id) AS (VALUES ${Prisma.join(pairs)}),
    ex_group AS (
      SELECT em."exerciseId", g.key, bool_or(em.role = 'PRIMARY') AS direct
      FROM "ExerciseMuscle" em
      JOIN groups g ON g.muscle_id = em."muscleId"
      WHERE em.role IN ('PRIMARY', 'SECONDARY')
      GROUP BY em."exerciseId", g.key
    )
    SELECT ${spMondayNo(Prisma.sql`s."finishedAt"`)} AS monday, eg.key,
      sum(CASE WHEN eg.direct THEN 1 ELSE 0.5 END)::float8 AS sets,
      (count(*) FILTER (WHERE eg.direct))::int AS direct
    FROM "SetLog" x
    JOIN "WorkoutSession" s ON s.id = x."sessionId"
    JOIN "Exercise" e ON e.id = x."exerciseId"
    JOIN ex_group eg ON eg."exerciseId" = x."exerciseId"
    WHERE x."userId" = ${userId}
      AND s."userId" = ${userId}
      AND s.status = 'COMPLETED'
      AND s."finishedAt" >= ${since}
      AND x."isCompleted" AND x."setType" <> 'WARMUP'
      AND e.category NOT IN ('STRETCHING', 'CARDIO')
    GROUP BY 1, 2`;
  return rows.map((r) => ({ monday: Number(r.monday), key: r.key, sets: Number(r.sets), direct: Number(r.direct) }));
}
