import "server-only";
import { prisma } from "@/lib/db";

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
