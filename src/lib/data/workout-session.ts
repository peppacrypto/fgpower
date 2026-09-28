import "server-only";
import { prisma } from "@/lib/db";
import { APP_TIME_ZONE } from "@/lib/training/week";
import { isPartialEntryWeek } from "@/lib/training/program-calendar";
import {
  baselineRir,
  effectiveProgramWeek,
  getWeekGuidance,
  programWeekView,
  weekRirTarget,
  type ProgramWeekView,
  type RirExercise,
  type WeekGuidanceView,
} from "@/lib/training/week-guidance";
import { isTimedHold } from "@/lib/training/set-plan";
import { countedWeeks } from "@/lib/programming/block-progress";
import { entryWeekWasTrained } from "./program-lifecycle";

/**
 * The workout screen's data in a fixed number of queries, whatever the number
 * of exercises: the session tree (narrow selects — never the exercise's
 * instructions/content JSON), last time's sets for every exercise in one
 * query, the machine notes in one query, and the few profile fields the
 * screen needs. Everything but the session tree is keyed on the session id,
 * so all of it runs in parallel.
 */
export async function getWorkoutSessionForExecution(sessionId: string) {
  return prisma.workoutSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      name: true,
      status: true,
      startedAt: true,
      notes: true,
      programId: true,
      program: { select: { progressionStrategy: true } },
      exerciseLogs: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          exerciseId: true,
          sortOrder: true,
          prescribedSets: true,
          warmupSets: true,
          repMin: true,
          repMax: true,
          rirTarget: true,
          restSeconds: true,
          wasSkipped: true,
          notes: true,
          exercise: {
            select: {
              slug: true,
              namePt: true,
              media: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true } },
              // Bodyweight exercises log reps only: kg is extra load (set-plan isBodyweightEquipment).
              equipment: { select: { category: true } },
              // A free-weight compound's RIR floor under the week's wave (rirExerciseOf).
              mechanics: true,
            },
          },
          programExercise: { select: { progressionStrategy: true, loadIncrementKg: true } },
          sets: {
            orderBy: { setNumber: "asc" },
            select: {
              id: true,
              setNumber: true,
              setType: true,
              isExtra: true,
              weightKg: true,
              reps: true,
              rir: true,
              isCompleted: true,
              completedAt: true,
              updatedAt: true,
              notes: true,
            },
          },
        },
      },
    },
  });
}

export interface PreviousPerformance {
  exerciseId: string;
  /** When that workout was done (its finish; the log's start without one). */
  doneAt: Date;
  /** Working sets that workout prescribed for the exercise. */
  prescribedSets: number;
  /** Its completed working sets, in order (extras flagged). */
  sets: { weightKg: number | null; reps: number | null; rir: number | null; isExtra: boolean }[];
}

/**
 * For every exercise of the session, the user's most recent COMPLETED
 * performance in another session — one query (DISTINCT ON), not one per
 * exercise. Only logs where at least one working set was actually done count:
 * an exercise skipped or left empty must not hide the last real loads.
 * Keyed by exerciseId.
 */
export async function getPreviousPerformances(userId: string, sessionId: string) {
  const rows = await prisma.$queryRaw<
    {
      exerciseId: string;
      doneAt: Date;
      prescribedSets: number;
      sets: PreviousPerformance["sets"] | string;
    }[]
  >`
    WITH last AS (
      SELECT DISTINCT ON (l."exerciseId")
        l.id, l."exerciseId", l."prescribedSets", COALESCE(s."finishedAt", l."createdAt") AS "doneAt"
      FROM "WorkoutExerciseLog" l
      JOIN "WorkoutSession" s ON s.id = l."sessionId"
      WHERE l."userId" = ${userId}
        AND l."sessionId" <> ${sessionId}
        AND s.status = 'COMPLETED'
        AND l."exerciseId" IN (
          SELECT c."exerciseId" FROM "WorkoutExerciseLog" c WHERE c."sessionId" = ${sessionId} AND c."userId" = ${userId}
        )
        AND EXISTS (
          SELECT 1 FROM "SetLog" x WHERE x."exerciseLogId" = l.id AND x."isCompleted" AND x."setType" = 'WORKING'
        )
      ORDER BY l."exerciseId", COALESCE(s."finishedAt", l."createdAt") DESC, l."createdAt" DESC
    )
    SELECT last."exerciseId", last."doneAt", last."prescribedSets",
      json_agg(
        json_build_object('weightKg', x."weightKg", 'reps', x.reps, 'rir', x.rir, 'isExtra', x."isExtra")
        ORDER BY x."setNumber"
      ) AS sets
    FROM last
    JOIN "SetLog" x ON x."exerciseLogId" = last.id AND x."isCompleted" AND x."setType" = 'WORKING'
    GROUP BY last."exerciseId", last."doneAt", last."prescribedSets"`;
  const out = new Map<string, PreviousPerformance>();
  for (const r of rows) {
    const sets = typeof r.sets === "string" ? (JSON.parse(r.sets) as PreviousPerformance["sets"]) : r.sets;
    out.set(r.exerciseId, { exerciseId: r.exerciseId, doneAt: new Date(r.doneAt), prescribedSets: r.prescribedSets, sets });
  }
  return out;
}

/** The user's machine/exercise notes for the session's exercises, keyed by exerciseId — one query. */
export async function getExerciseNotesForSession(userId: string, sessionId: string) {
  const notes = await prisma.exerciseUserNote.findMany({
    where: { userId, exercise: { exerciseLogs: { some: { sessionId } } } },
    select: { exerciseId: true, note: true },
  });
  return new Map(notes.map((n) => [n.exerciseId, n.note]));
}

/**
 * What the workout screen needs from the profile, plus whether the user is on
 * one of their first workouts (fewer than `firstWorkouts` finished).
 */
export async function getWorkoutUserContext(userId: string, firstWorkouts = 3) {
  const [profile, finished] = await Promise.all([
    prisma.profile.findUnique({
      where: { userId },
      select: { restTimerSound: true, loadIncrementKg: true, limitations: true },
    }),
    prisma.workoutSession.findMany({
      where: { userId, status: "COMPLETED" },
      select: { id: true },
      take: firstWorkouts,
    }),
  ]);
  return { profile, finishedWorkouts: finished.length };
}

/**
 * The program week a workout belongs to and that week's guidance (W-054):
 * the week the workout will be saved in (advanceProgram's rule — the first
 * workout of a new calendar week starts the next program week), counted as
 * Today counts it (an entry week reads week 1). Null outside a program or
 * when the program has no guidance for that week. Two small counts.
 */
export async function getWorkoutWeek(
  userId: string,
  sessionId: string,
): Promise<{
  view: ProgramWeekView;
  guidance: WeekGuidanceView;
  durationWeeks: number | null;
  /** The RIR the program's exercises are written at (week-guidance baselineRir): the wave moves them from it. */
  baselineRir: number | null;
} | null> {
  // One round trip, keyed on the session id (it runs next to the session tree,
  // not after it). Weeks are São Paulo Monday-start weeks (lib/training/week),
  // counted as advanceProgram counts them: finished workouts of the
  // enrollment with a working set, other than this one.
  const rows = await prisma.$queryRaw<
    {
      startedAt: Date;
      enrolledAt: Date;
      currentWeek: number;
      weeklyGuidance: unknown;
      durationWeeks: number | null;
      slug: string | null;
      thisWeek: bigint | number;
      before: bigint | number;
      inEntryWeek: bigint | number;
    }[]
  >`
    WITH s AS (
      SELECT s.id, s."userId", s."startedAt", s."enrollmentId", s."programId",
        ((date_trunc('week', (s."startedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${APP_TIME_ZONE}) AT TIME ZONE ${APP_TIME_ZONE}) AT TIME ZONE 'UTC') AS "weekStart"
      FROM "WorkoutSession" s
      WHERE s.id = ${sessionId} AND s."userId" = ${userId}
    ), e AS (
      SELECT e.id, e."startedAt", e."currentWeek",
        ((date_trunc('week', (e."startedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${APP_TIME_ZONE}) AT TIME ZONE ${APP_TIME_ZONE}) AT TIME ZONE 'UTC') AS "entryStart"
      FROM "ProgramEnrollment" e JOIN s ON s."enrollmentId" = e.id
    ), done AS (
      SELECT x."finishedAt" FROM "WorkoutSession" x, s
      WHERE x."userId" = s."userId" AND x."enrollmentId" = s."enrollmentId" AND x.id <> s.id
        AND x.status = 'COMPLETED' AND x."totalWorkingSets" > 0
    )
    SELECT s."startedAt", e."startedAt" AS "enrolledAt", e."currentWeek",
      p."weeklyGuidance", p."durationWeeks", t.slug,
      (SELECT count(*) FROM done WHERE done."finishedAt" >= s."weekStart") AS "thisWeek",
      (SELECT count(*) FROM done WHERE done."finishedAt" < s."weekStart") AS "before",
      (SELECT count(*) FROM done WHERE done."finishedAt" >= e."entryStart" AND done."finishedAt" < e."entryStart" + interval '7 days') AS "inEntryWeek"
    FROM s
    JOIN e ON true
    JOIN "UserProgram" p ON p.id = s."programId"
    LEFT JOIN "WorkoutTemplate" t ON t.id = p."sourceTemplateId"`;
  const r = rows[0];
  if (!r) return null;
  const effectiveWeek = effectiveProgramWeek({
    currentWeek: r.currentWeek,
    sessionsThisWeek: Number(r.thisWeek),
    trainedBefore: Number(r.before) > 0,
  });
  const enrolledAt = new Date(r.enrolledAt);
  const view = programWeekView({
    startedAt: enrolledAt,
    now: new Date(r.startedAt),
    effectiveWeek,
    entryWeekTrained: isPartialEntryWeek(enrolledAt) && Number(r.inEntryWeek) > 0,
  });
  const guidance = getWeekGuidance(r.weeklyGuidance, view.guidanceWeek, {
    templateSlug: r.slug,
    durationWeeks: r.durationWeeks,
  });
  return guidance ? { view, guidance, durationWeeks: r.durationWeeks, baselineRir: baselineRir(r.weeklyGuidance) } : null;
}

/** What the week's RIR needs to know about a logged exercise (week-guidance weekRirTarget). */
export function rirExerciseOf(log: {
  notes: string | null;
  exercise: { slug: string; mechanics: string; equipment: { category: string } | null };
}): RirExercise {
  return {
    freeWeightCompound: log.exercise.equipment?.category === "FREE_WEIGHT" && log.exercise.mechanics === "COMPOUND",
    notes: log.notes,
    timed: isTimedHold({ slug: log.exercise.slug, notes: log.notes }),
  };
}

/**
 * Per exercise log of a session, the RIR it aimed for (W-054): its own target
 * moved by its program week's wave (week-guidance weekRirTarget) — what the
 * workout screen showed, so the summary's "Na próxima" judges the sets by
 * the same target. A workout in progress reads the week it will be saved in
 * (getWorkoutWeek); a finished one, the week it was saved in (its programWeek,
 * less a trained entry week). Keyed by WorkoutExerciseLog id; a session
 * outside a program keeps each log's own target.
 */
export async function getSessionRirTargets(userId: string, sessionId: string): Promise<Map<string, number | null>> {
  const session = await prisma.workoutSession.findFirst({
    where: { id: sessionId, userId },
    select: {
      status: true,
      programWeek: true,
      enrollmentId: true,
      enrollment: { select: { startedAt: true } },
      program: { select: { weeklyGuidance: true, durationWeeks: true, sourceTemplate: { select: { slug: true } } } },
      exerciseLogs: {
        select: {
          id: true,
          rirTarget: true,
          notes: true,
          exercise: { select: { slug: true, mechanics: true, equipment: { select: { category: true } } } },
        },
      },
    },
  });
  if (!session) return new Map();
  let guidance: WeekGuidanceView | null = null;
  if (session.status === "IN_PROGRESS") {
    guidance = (await getWorkoutWeek(userId, sessionId))?.guidance ?? null;
  } else if (session.program && session.programWeek != null && session.enrollmentId && session.enrollment) {
    const trained = await entryWeekWasTrained(prisma, {
      id: session.enrollmentId,
      userId,
      startedAt: session.enrollment.startedAt,
    });
    guidance = getWeekGuidance(session.program.weeklyGuidance, countedWeeks(session.programWeek, session.enrollment.startedAt, trained), {
      templateSlug: session.program.sourceTemplate?.slug ?? null,
      durationWeeks: session.program.durationWeeks,
    });
  }
  const baseline = baselineRir(session.program?.weeklyGuidance ?? null);
  return new Map(
    session.exerciseLogs.map((log) => [
      log.id,
      weekRirTarget(log.rirTarget, guidance, { baseline, exercise: rirExerciseOf(log) }),
    ]),
  );
}

/**
 * For every exercise of the session, what a set has to beat to be a record
 * (W-122's PR moment): each load used before with its most reps, plus the set
 * behind the best reliable estimated 1RM — all personal-records-core needs to
 * judge a set against the user's other COMPLETED sessions, in one small
 * aggregate. An exercise absent here was never done before (its baseline).
 */
export async function getRecordBars(userId: string, sessionId: string) {
  const rows = await prisma.$queryRaw<{ exerciseId: string; weightKg: number; reps: number }[]>`
    SELECT x."exerciseId", x."weightKg", x.reps
    FROM "SetLog" x
    JOIN "WorkoutSession" s ON s.id = x."sessionId"
    WHERE x."userId" = ${userId}
      AND x."sessionId" <> ${sessionId}
      AND x."exerciseId" IN (SELECT l."exerciseId" FROM "WorkoutExerciseLog" l WHERE l."sessionId" = ${sessionId})
      AND s.status = 'COMPLETED'
      AND x."isCompleted" AND x."setType" IN ('WORKING', 'FAILURE')
      AND x."weightKg" IS NOT NULL AND x.reps >= 1
    GROUP BY x."exerciseId", x."weightKg", x.reps`;
  const byExercise = new Map<string, { weightKg: number; reps: number }[]>();
  for (const r of rows) {
    const list = byExercise.get(r.exerciseId) ?? [];
    list.push({ weightKg: Number(r.weightKg), reps: Number(r.reps) });
    byExercise.set(r.exerciseId, list);
  }
  return byExercise;
}
