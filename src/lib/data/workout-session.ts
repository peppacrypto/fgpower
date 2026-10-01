import "server-only";
import { prisma } from "@/lib/db";
import { APP_TIME_ZONE } from "@/lib/training/week";
import { isPartialEntryWeek } from "@/lib/training/program-calendar";
import {
  appliedDeloadGuidance,
  baselineRir,
  effectiveProgramWeek,
  getWeekGuidance,
  programWeekView,
  weekRirTarget,
  type ProgramWeekView,
  type RirExercise,
  type WeekGuidanceView,
} from "@/lib/training/week-guidance";
import { dayNumberOf, mondayOf } from "@/lib/training/day-rotation";
import { isAppliedDeload } from "@/lib/training/deload";
import { isTimedHold } from "@/lib/training/set-plan";
import { countedWeeks } from "@/lib/programming/block-progress";
import { parseExerciseContent, parseInstructions } from "@/lib/exercises/content";
import { entryWeekWasTrained } from "./program-lifecycle";
import { getAlternatives, mainGearFirst, type AlternativeExercise } from "./alternatives";
import { listExercises } from "./exercises";

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
          // Supersets / circuits (W-104): adjacent logs sharing a key (lib/programming groups).
          groupKey: true,
          // "Trocado · no lugar de …" (W-006): the exercise the program asked for.
          substitutedFromExerciseId: true,
          substitutedFrom: { select: { namePt: true } },
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
 * an exercise skipped or left empty must not hide the last real loads. A
 * deload workout (W-128: half the sets, RIR 3-4 on purpose) is never the
 * reference for a normal one — "Na próxima" starts from the last workout
 * before it; within a deload week it is (the same light loads).
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
        AND (NOT s."isDeload" OR (SELECT c."isDeload" FROM "WorkoutSession" c WHERE c.id = ${sessionId}))
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
      select: { restTimerSound: true, hapticsEnabled: true, loadIncrementKg: true, limitations: true },
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
 *
 * A deload workout (opened in a week the user turned into a deload, W-128)
 * reads the applied deload's guidance — RIR raised, its own instructions —
 * even in a program without guidance; a workout opened in that week before
 * the deload was applied keeps its week's RIR but reads as a deload week
 * (lib/training/deload: the week is one).
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
      isDeload: boolean;
      deloadMondays: number[];
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
      SELECT s.id, s."userId", s."startedAt", s."enrollmentId", s."programId", s."isDeload",
        ((date_trunc('week', (s."startedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${APP_TIME_ZONE}) AT TIME ZONE ${APP_TIME_ZONE}) AT TIME ZONE 'UTC') AS "weekStart"
      FROM "WorkoutSession" s
      WHERE s.id = ${sessionId} AND s."userId" = ${userId}
    ), e AS (
      SELECT e.id, e."startedAt", e."currentWeek", e."deloadMondays",
        ((date_trunc('week', (e."startedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${APP_TIME_ZONE}) AT TIME ZONE ${APP_TIME_ZONE}) AT TIME ZONE 'UTC') AS "entryStart"
      FROM "ProgramEnrollment" e JOIN s ON s."enrollmentId" = e.id
    ), done AS (
      SELECT x."finishedAt" FROM "WorkoutSession" x, s
      WHERE x."userId" = s."userId" AND x."enrollmentId" = s."enrollmentId" AND x.id <> s.id
        AND x.status = 'COMPLETED' AND x."totalWorkingSets" > 0
    )
    SELECT s."startedAt", s."isDeload", e."deloadMondays", e."startedAt" AS "enrolledAt", e."currentWeek",
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
  const planned = getWeekGuidance(r.weeklyGuidance, view.guidanceWeek, {
    templateSlug: r.slug,
    durationWeeks: r.durationWeeks,
  });
  const appliedWeek = isAppliedDeload(r.deloadMondays, mondayOf(dayNumberOf(new Date(r.startedAt))));
  const guidance = r.isDeload
    ? appliedDeloadGuidance(planned, view.guidanceWeek)
    : planned && appliedWeek
      ? { ...planned, deload: true }
      : planned;
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
      isDeload: true,
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
    const week = countedWeeks(session.programWeek, session.enrollment.startedAt, trained);
    guidance = getWeekGuidance(session.program.weeklyGuidance, week, {
      templateSlug: session.program.sourceTemplate?.slug ?? null,
      durationWeeks: session.program.durationWeeks,
    });
    // A deload workout aimed for the applied deload's raised targets (W-128).
    if (session.isDeload) guidance = appliedDeloadGuidance(guidance, week);
  } else if (session.isDeload) {
    guidance = appliedDeloadGuidance(null, 1);
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

// ---------------------------------------------------------------------------
// Adapting the workout to the gym (W-006) and the technique sheet (W-025)
// ---------------------------------------------------------------------------

/** An exercise offered by the workout's "Trocar" / "Adicionar exercício" sheet. */
export interface ExerciseOption {
  id: string;
  slug: string;
  namePt: string;
  imageUrl: string | null;
  equipment: string | null;
  /**
   * Why it is offered: a curated relation or the same muscle (+ movement) —
   * alternatives.ts —, "ORIGINAL" for the program's own exercise after a
   * swap (to swap back), "SEARCH" for a search hit, "POPULAR" for the
   * library's first picks when there is nothing to match against.
   */
  reason: AlternativeExercise["reason"] | "ORIGINAL" | "SEARCH" | "POPULAR";
}

export interface ExerciseOptions {
  options: ExerciseOption[];
  /**
   * The exercise being swapped already holds data on the server (a set typed
   * or ✓'d): it can't be replaced — the pick is added after it instead.
   */
  hasData: boolean;
}

type CardLike = {
  id: string;
  slug: string;
  namePt: string;
  equipment: { namePt: string } | null;
  media: { url: string }[];
};
function optionOf(e: CardLike, reason: ExerciseOption["reason"]): ExerciseOption {
  return {
    id: e.id,
    slug: e.slug,
    namePt: e.namePt,
    imageUrl: e.media[0]?.url ?? null,
    equipment: e.equipment?.namePt ?? null,
    reason,
  };
}

/**
 * What the sheet lists for one of the user's workouts in progress: with a
 * query, the library's search; without one, the stand-ins for the exercise
 * being swapped (alternatives.ts: curated relations first, then the same
 * primary muscle and movement, on the equipment the profile has — judged
 * against the program's exercise when it was already swapped, which comes
 * first to swap back), or, when adding at the end, the library's first
 * picks. Exercises already in the workout are never listed, searched or not
 * (swapExercise / addExerciseToWorkout refuse them too) — the program's own,
 * to swap back, only while it isn't one of them (added elsewhere after the
 * swap). Null when the workout isn't the user's or is closed.
 */
export async function getExerciseOptions(
  userId: string,
  p: { sessionId: string; exerciseLogId?: string | null; q?: string | null },
): Promise<ExerciseOptions | null> {
  const session = await prisma.workoutSession.findFirst({
    where: { id: p.sessionId, userId, status: "IN_PROGRESS" },
    select: { exerciseLogs: { select: { id: true, exerciseId: true, substitutedFromExerciseId: true } } },
  });
  if (!session) return null;
  const log = p.exerciseLogId ? session.exerciseLogs.find((l) => l.id === p.exerciseLogId) : undefined;
  if (p.exerciseLogId && !log) return null;
  const inWorkout = session.exerciseLogs.map((l) => l.exerciseId);
  const hasData = log
    ? (await prisma.setLog.count({
        where: {
          exerciseLogId: log.id,
          OR: [{ isCompleted: true }, { weightKg: { not: null } }, { reps: { not: null } }],
        },
      })) > 0
    : false;

  const q = (p.q ?? "").trim().slice(0, 80);
  if (q.length >= 2) {
    const { items } = await listExercises({ q, pageSize: 20 });
    // Never one already in the workout (a second copy of it). The program's own, swapped away
    // from, isn't in it — unless it was added elsewhere since, and then swapping back is refused.
    return {
      options: items
        .filter((e) => !inWorkout.includes(e.id))
        .map((e) => optionOf(e, e.id === log?.substitutedFromExerciseId ? "ORIGINAL" : "SEARCH")),
      hasData,
    };
  }

  if (!log) {
    const { items } = await listExercises({ pageSize: 20 });
    return { options: items.filter((e) => !inWorkout.includes(e.id)).map((e) => optionOf(e, "POPULAR")), hasData };
  }

  const profile = await prisma.profile.findUnique({ where: { userId }, select: { equipmentAccess: true } });
  const base = log.substitutedFromExerciseId ?? log.exerciseId;
  const [original, alternatives] = await Promise.all([
    log.substitutedFromExerciseId && !inWorkout.includes(log.substitutedFromExerciseId)
      ? prisma.exercise.findUnique({
          where: { id: log.substitutedFromExerciseId },
          select: {
            id: true,
            slug: true,
            namePt: true,
            equipment: { select: { namePt: true } },
            media: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true } },
          },
        })
      : null,
    // At home the user's main gear leads (dumbbells for "Halteres em casa"), as in "Adaptar".
    getAlternatives(base, { equipmentAccess: profile?.equipmentAccess ?? null, limit: 12, excludeIds: inWorkout }).then(
      (options) => mainGearFirst(options, profile?.equipmentAccess ?? null),
    ),
  ]);
  const options: ExerciseOption[] = original ? [optionOf(original, "ORIGINAL")] : [];
  for (const a of alternatives) {
    options.push({
      id: a.id,
      slug: a.slug,
      namePt: a.namePt,
      imageUrl: a.imageUrl,
      equipment: a.equipmentNamePt,
      reason: a.reason,
    });
  }
  return { options, hasData };
}

/** The in-workout technique sheet (W-025): the start/end frames and the three cues to keep in mind. */
export interface TechniqueSheet {
  slug: string;
  namePt: string;
  images: { start: string | null; end: string | null };
  cues: string[];
  /** Where the cues come from: curated coaching cues, or the imported step-by-step. */
  source: "coaching" | "instructions" | null;
}

/**
 * Three key cues: the curated content's coaching cues (Exercise.contentPt),
 * else the first steps of the imported instructions. Unpublished exercises
 * too: the sheet opens on an exercise of the user's own workout, which an
 * exercise taken out of the library can still be (its full page opens too).
 */
export async function getTechniqueSheet(exerciseId: string): Promise<TechniqueSheet | null> {
  const e = await prisma.exercise.findUnique({
    where: { id: exerciseId },
    select: {
      slug: true,
      namePt: true,
      contentPt: true,
      instructionsPt: true,
      media: { orderBy: { sortOrder: "asc" }, select: { url: true, kind: true } },
    },
  });
  if (!e) return null;
  const coaching = parseExerciseContent(e.contentPt)?.coachingCues.filter((c) => c.trim() !== "") ?? [];
  const steps = parseInstructions(e.instructionsPt).filter((c) => c.trim() !== "");
  const cues = coaching.length > 0 ? coaching : steps;
  const start = e.media.find((m) => m.kind === "IMAGE_START") ?? e.media[0] ?? null;
  const end = e.media.find((m) => m.kind === "IMAGE_END") ?? e.media.find((m) => m !== start) ?? null;
  return {
    slug: e.slug,
    namePt: e.namePt,
    images: { start: start?.url ?? null, end: end?.url ?? null },
    cues: cues.slice(0, 3),
    source: coaching.length > 0 ? "coaching" : steps.length > 0 ? "instructions" : null,
  };
}

/** How long a finished workout can still be corrected or deleted (W-088). */
export const FINISHED_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * When a finished workout was saved — where its correction window starts.
 * Its `finishedAt`, except for a workout left open and saved later "como
 * feito em 20/09": that one is dated on its own day, and was saved when its
 * row was last written (`updatedAt`: the finish; a correction keeps it, see
 * editFinishedWorkout). Without this, such a workout could never be fixed.
 */
export function savedAt(s: { finishedAt: Date; updatedAt: Date }): Date {
  return s.updatedAt > s.finishedAt ? s.updatedAt : s.finishedAt;
}

/** Until when a finished workout can be corrected or deleted. */
export function correctableUntil(s: { finishedAt: Date; updatedAt: Date }): Date {
  return new Date(savedAt(s).getTime() + FINISHED_EDIT_WINDOW_MS);
}

/** Whether a finished workout (see savedAt) can still be corrected or deleted. */
export function isStillEditable(s: { finishedAt: Date; updatedAt: Date }, now: Date = new Date()): boolean {
  return now.getTime() < correctableUntil(s).getTime();
}
