import "server-only";
import { prisma } from "@/lib/db";
import { detectExerciseRecords, type PriorSet, type ScoredSet } from "./personal-records-core";

const WORKING_TYPES = ["WORKING", "FAILURE"] as const;

/**
 * Scans a just-finished session's completed working sets and records any new
 * personal records (spec §43.7; rules in personal-records-core.ts). Called
 * once, from finishWorkoutSession — never on every set, so PRs stay
 * meaningful rather than spammy.
 *
 * Each exercise is measured against its completed working sets in the user's
 * OTHER COMPLETED sessions finished BEFORE this one (never this session's own
 * sets, never a discarded or in-progress workout, never a workout done after
 * it — a stale workout saved later "como feito em dd/mm" is judged against
 * its own past); an exercise logged for the first time is its baseline and
 * records nothing. Later sessions aren't rescored. Idempotent: a second run
 * for the same session replaces its records instead of duplicating them.
 *
 * Returns the ids of the exercises logged here for the first time (baseline).
 */
export async function checkAndRecordPersonalRecords(userId: string, sessionId: string): Promise<string[]> {
  const sets = await prisma.setLog.findMany({
    where: {
      sessionId,
      userId,
      isCompleted: true,
      setType: { in: [...WORKING_TYPES] },
      weightKg: { not: null },
      reps: { gte: 1 },
    },
    select: { id: true, exerciseId: true, weightKg: true, reps: true },
    orderBy: [{ exerciseLog: { sortOrder: "asc" } }, { setNumber: "asc" }],
  });
  if (sets.length === 0) return [];
  const finishedAt = (await prisma.workoutSession.findUnique({ where: { id: sessionId }, select: { finishedAt: true } }))
    ?.finishedAt;

  const byExercise = new Map<string, ScoredSet[]>();
  for (const s of sets) {
    const list = byExercise.get(s.exerciseId) ?? [];
    list.push({ id: s.id, weightKg: s.weightKg as number, reps: s.reps as number });
    byExercise.set(s.exerciseId, list);
  }

  // Every distinct (load, reps) pair done before, per exercise — all the rules
  // need, in one small aggregate instead of every historical set.
  const priorRows = await prisma.setLog.groupBy({
    by: ["exerciseId", "weightKg", "reps"],
    where: {
      userId,
      exerciseId: { in: [...byExercise.keys()] },
      sessionId: { not: sessionId },
      session: { status: "COMPLETED", ...(finishedAt ? { finishedAt: { lt: finishedAt } } : {}) },
      isCompleted: true,
      setType: { in: [...WORKING_TYPES] },
      weightKg: { not: null },
      reps: { gte: 1 },
    },
  });
  const prior = new Map<string, PriorSet[]>();
  for (const row of priorRows) {
    if (row.weightKg == null || row.reps == null) continue;
    const list = prior.get(row.exerciseId) ?? [];
    list.push({ weightKg: row.weightKg, reps: row.reps });
    prior.set(row.exerciseId, list);
  }

  const baseline: string[] = [];
  const rows: {
    userId: string;
    exerciseId: string;
    kind: "MAX_WEIGHT" | "ESTIMATED_1RM" | "MAX_REPS_AT_WEIGHT";
    value: number;
    weightKg: number;
    reps: number;
    setLogId: string;
    sessionId: string;
  }[] = [];
  for (const [exerciseId, exerciseSets] of byExercise) {
    const result = detectExerciseRecords(exerciseSets, prior.get(exerciseId) ?? []);
    if (result.baseline) baseline.push(exerciseId);
    for (const r of result.records) rows.push({ userId, exerciseId, sessionId, ...r });
  }

  await prisma.$transaction([
    prisma.exercisePersonalRecord.deleteMany({ where: { userId, sessionId } }),
    ...(rows.length > 0 ? [prisma.exercisePersonalRecord.createMany({ data: rows })] : []),
  ]);
  return baseline;
}
