import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { SHOWN_PR_KINDS } from "@/lib/training/personal-records-core";
import { countedWeeks } from "@/lib/programming/block-progress";
import { entryWeekWasTrained } from "./program-lifecycle";
import type { SessionPerf } from "./progress-core";

/**
 * A finished workout as the history lists it: completed with at least one
 * working set (legacy empty ones aren't workouts — the streak's rule).
 */
const DONE = { status: "COMPLETED" as const, totalWorkingSets: { gt: 0 } };

/** Completed sessions finished in [from, to) — pass `monthBounds()` from lib/training/week. */
export async function listSessionsInRange(userId: string, from: Date, to: Date) {
  const sessions = await prisma.workoutSession.findMany({
    where: { userId, ...DONE, finishedAt: { gte: from, lt: to } },
    orderBy: [{ finishedAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      name: true,
      finishedAt: true,
      durationSeconds: true,
      totalVolumeKg: true,
      totalWorkingSets: true,
    },
  });
  return withRecordCounts(userId, sessions);
}

/**
 * One page of completed sessions, newest first. `page` is clamped to
 * [1, totalPages] (a stale ?page=99 link shows the last page instead of an
 * empty list) and the page actually served is returned. Each row carries what
 * a history row shows: duration, sets, volume, records and its program week
 * as Today numbers it (`countedWeek`: 0 in a Thursday–Sunday entry week).
 */
export async function listAllSessions(userId: string, page = 1, pageSize = 20) {
  const total = await prisma.workoutSession.count({ where: { userId, ...DONE } });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Number.isSafeInteger(page) ? Math.min(Math.max(page, 1), totalPages) : 1;
  const rows = await prisma.workoutSession.findMany({
    where: { userId, ...DONE },
    orderBy: [{ finishedAt: "desc" }, { id: "desc" }],
    skip: (safePage - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      name: true,
      finishedAt: true,
      durationSeconds: true,
      totalWorkingSets: true,
      totalVolumeKg: true,
      programWeek: true,
      enrollmentId: true,
      program: { select: { name: true } },
      enrollment: { select: { startedAt: true } },
    },
  });
  const entryTrained = await entryWeeksTrained(userId, rows);
  const items = (await withRecordCounts(userId, rows)).map((s) => ({
    ...s,
    countedWeek:
      s.programWeek == null
        ? null
        : s.enrollmentId && s.enrollment
          ? countedWeeks(s.programWeek, s.enrollment.startedAt, entryTrained.has(s.enrollmentId))
          : s.programWeek,
  }));
  return { items, total, page: safePage, totalPages };
}

/**
 * The enrollments (of these sessions) whose Thursday–Sunday entry week had a
 * workout: only then did that week take a number on the week counter, so only
 * then is it subtracted — the program lifecycle's own rule
 * (program-lifecycle entryWeekWasTrained), the one Today and the block use.
 */
async function entryWeeksTrained(
  userId: string,
  sessions: { enrollmentId: string | null; enrollment: { startedAt: Date } | null }[],
): Promise<Set<string>> {
  const enrollments = new Map<string, Date>();
  for (const s of sessions) if (s.enrollmentId && s.enrollment) enrollments.set(s.enrollmentId, s.enrollment.startedAt);
  const trained = await Promise.all(
    [...enrollments].map(async ([id, startedAt]) =>
      (await entryWeekWasTrained(prisma, { id, userId, startedAt })) ? id : null,
    ),
  );
  return new Set(trained.filter((id): id is string => id !== null));
}

/** Adds each session's record count (records shown in the app — no legacy volume rows). */
async function withRecordCounts<S extends { id: string }>(userId: string, sessions: S[]) {
  if (sessions.length === 0) return [] as (S & { recordCount: number })[];
  const counts = await prisma.exercisePersonalRecord.groupBy({
    by: ["sessionId"],
    where: { userId, sessionId: { in: sessions.map((s) => s.id) }, kind: { in: [...SHOWN_PR_KINDS] } },
    _count: { _all: true },
  });
  const bySession = new Map(counts.map((c) => [c.sessionId, c._count._all]));
  return sessions.map((s) => ({ ...s, recordCount: bySession.get(s.id) ?? 0 }));
}

// ---------------------------------------------------------------------------
// Per-exercise performance, aggregated in the database
// ---------------------------------------------------------------------------

/**
 * The completed working sets that count (warm-ups, and sets without a load
 * or reps, never do), for SetLog `x`.
 */
export const COUNTED_SET = Prisma.sql`x."isCompleted" AND x."setType" IN ('WORKING', 'FAILURE') AND x."weightKg" IS NOT NULL AND x.reps >= 1`;

/** Epley e1RM of set `x` when reliable (load > 0, ≤ 10 reps — estimated-1rm.ts), else NULL. */
const E1RM = Prisma.sql`CASE WHEN x."weightKg" > 0 AND x.reps <= 10 THEN CASE WHEN x.reps = 1 THEN x."weightKg" ELSE x."weightKg" * (1 + x.reps / 30.0::float8) END END`;

/** One exercise's sets of one session summed up (the columns of SessionPerf). */
export const SESSION_PERF_COLUMNS = Prisma.sql`
  MAX(x."weightKg")::float8 AS "topKg",
  (ARRAY_AGG(x.reps ORDER BY x."weightKg" DESC, x.reps DESC))[1]::int AS "topReps",
  MAX(${E1RM})::float8 AS "e1rmKg",
  (ARRAY_AGG(x."weightKg" ORDER BY ${E1RM} DESC NULLS LAST, x."weightKg" DESC))[1]::float8 AS "e1rmSetKg",
  (ARRAY_AGG(x.reps ORDER BY ${E1RM} DESC NULLS LAST, x."weightKg" DESC))[1]::int AS "e1rmSetReps",
  MAX(x.reps)::int AS "bestReps",
  (ARRAY_AGG(x."weightKg" ORDER BY x.reps DESC, x."weightKg" DESC))[1]::float8 AS "bestRepsKg",
  SUM(x.reps)::int AS "totalReps",
  SUM(x."weightKg" * x.reps)::float8 AS "volumeKg",
  COUNT(*)::int AS sets`;

export type SessionPerfRow = Omit<SessionPerf, "date"> & { date: Date | string };

/** A raw aggregate row as SessionPerf (e1RM rounded like estimate1Rm; a set without one has none). */
export function toSessionPerf(r: SessionPerfRow): SessionPerf {
  const e1 = r.e1rmKg != null ? Math.round(r.e1rmKg * 10) / 10 : null;
  return {
    sessionId: r.sessionId,
    date: new Date(r.date),
    topKg: r.topKg,
    topReps: r.topReps,
    e1rmKg: e1,
    e1rmSetKg: e1 != null ? r.e1rmSetKg : null,
    e1rmSetReps: e1 != null ? r.e1rmSetReps : null,
    bestReps: r.bestReps,
    bestRepsKg: r.bestRepsKg,
    totalReps: r.totalReps,
    volumeKg: r.volumeKg,
    sets: r.sets,
  };
}

/** Sessions read for one exercise's history — years of training fit well inside it. */
const HISTORY_LIMIT = 600;

/**
 * One point per finished session in which the exercise was actually done (at
 * least one completed working set — an exercise skipped or left empty in a
 * workout is not a session of it), oldest first, by when the workout was
 * finished. Aggregated in SQL: one row per session, never every set.
 */
export async function getExerciseHistory(userId: string, exerciseId: string): Promise<SessionPerf[]> {
  const rows = await prisma.$queryRaw<SessionPerfRow[]>`
    SELECT s.id AS "sessionId", s."finishedAt" AS date, ${SESSION_PERF_COLUMNS}
    FROM "WorkoutExerciseLog" l
    JOIN "WorkoutSession" s ON s.id = l."sessionId"
    JOIN "SetLog" x ON x."exerciseLogId" = l.id AND x."userId" = ${userId}
    WHERE l."userId" = ${userId}
      AND l."exerciseId" = ${exerciseId}
      AND s.status = 'COMPLETED'
      AND s."finishedAt" IS NOT NULL
      AND ${COUNTED_SET}
    GROUP BY s.id, s."finishedAt"
    ORDER BY s."finishedAt" DESC, s.id DESC
    LIMIT ${HISTORY_LIMIT}`;
  return rows.map(toSessionPerf).reverse();
}

/**
 * The exercise's record ledger, newest first (session-volume rows are legacy
 * and left out). Records are rare — a few per exercise per month at most.
 */
export async function getExercisePersonalRecords(userId: string, exerciseId: string) {
  return prisma.exercisePersonalRecord.findMany({
    where: { userId, exerciseId, kind: { in: [...SHOWN_PR_KINDS] } },
    orderBy: [{ achievedAt: "desc" }, { id: "desc" }],
    take: 200,
    select: { id: true, kind: true, value: true, weightKg: true, reps: true, achievedAt: true, sessionId: true },
  });
}

export async function getExerciseNote(userId: string, exerciseId: string) {
  return prisma.exerciseUserNote.findUnique({ where: { userId_exerciseId: { userId, exerciseId } } });
}
