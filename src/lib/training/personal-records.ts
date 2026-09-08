import "server-only";
import { prisma } from "@/lib/db";
import { estimate1Rm } from "./estimated-1rm";

/**
 * Scans a just-finished session's completed working sets and records any
 * new personal records (spec §43.7). Called once, from
 * finishWorkoutSession — never on every set, so PRs stay meaningful rather
 * than spammy.
 */
export async function checkAndRecordPersonalRecords(userId: string, sessionId: string) {
  const sets = await prisma.setLog.findMany({
    where: { sessionId, userId, isCompleted: true, setType: { in: ["WORKING", "FAILURE"] } },
    include: { exercise: { select: { id: true } } },
  });
  if (sets.length === 0) return;

  const byExercise = new Map<string, typeof sets>();
  for (const s of sets) {
    if (s.weightKg == null || s.reps == null) continue;
    const list = byExercise.get(s.exerciseId) ?? [];
    list.push(s);
    byExercise.set(s.exerciseId, list);
  }

  for (const [exerciseId, exerciseSets] of byExercise) {
    await recordForExercise(userId, exerciseId, sessionId, exerciseSets);
  }
}

async function recordForExercise(
  userId: string,
  exerciseId: string,
  sessionId: string,
  sets: { id: string; weightKg: number | null; reps: number | null }[],
) {
  // --- MAX_WEIGHT ---
  const best = sets.reduce((a, b) => ((b.weightKg ?? 0) > (a.weightKg ?? 0) ? b : a));
  await maybeRecordPr(userId, exerciseId, "MAX_WEIGHT", best.weightKg ?? 0, {
    weightKg: best.weightKg,
    reps: best.reps,
    setLogId: best.id,
    sessionId,
  });

  // --- ESTIMATED_1RM ---
  let best1Rm = { value: 0, setLogId: "", weightKg: null as number | null, reps: null as number | null };
  for (const s of sets) {
    if (s.weightKg == null || s.reps == null) continue;
    const est = estimate1Rm(s.weightKg, s.reps);
    if (est.reliable && est.epleyKg && est.epleyKg > best1Rm.value) {
      best1Rm = { value: est.epleyKg, setLogId: s.id, weightKg: s.weightKg, reps: s.reps };
    }
  }
  if (best1Rm.value > 0) {
    await maybeRecordPr(userId, exerciseId, "ESTIMATED_1RM", best1Rm.value, {
      weightKg: best1Rm.weightKg,
      reps: best1Rm.reps,
      setLogId: best1Rm.setLogId,
      sessionId,
    });
  }

  // --- MAX_REPS_AT_WEIGHT (per distinct weight logged this session) ---
  const byWeight = new Map<number, { reps: number; setLogId: string }>();
  for (const s of sets) {
    if (s.weightKg == null || s.reps == null) continue;
    const cur = byWeight.get(s.weightKg);
    if (!cur || s.reps > cur.reps) byWeight.set(s.weightKg, { reps: s.reps, setLogId: s.id });
  }
  for (const [weightKg, { reps, setLogId }] of byWeight) {
    const priorBest = await prisma.setLog.findFirst({
      where: {
        userId,
        exerciseId,
        weightKg,
        isCompleted: true,
        id: { not: setLogId },
      },
      orderBy: { reps: "desc" },
      select: { reps: true },
    });
    if (!priorBest || (priorBest.reps ?? 0) < reps) {
      await maybeRecordPr(userId, exerciseId, "MAX_REPS_AT_WEIGHT", reps, {
        weightKg,
        reps,
        setLogId,
        sessionId,
      });
    }
  }

  // --- SESSION_VOLUME ---
  const sessionVolume = sets.reduce((sum, s) => sum + (s.weightKg ?? 0) * (s.reps ?? 0), 0);
  await maybeRecordPr(userId, exerciseId, "SESSION_VOLUME", sessionVolume, { sessionId });
}

async function maybeRecordPr(
  userId: string,
  exerciseId: string,
  kind: "MAX_WEIGHT" | "ESTIMATED_1RM" | "MAX_REPS_AT_WEIGHT" | "SESSION_VOLUME",
  value: number,
  extra: { weightKg?: number | null; reps?: number | null; setLogId?: string; sessionId?: string },
) {
  if (value <= 0) return;
  const existingBest = await prisma.exercisePersonalRecord.findFirst({
    where: { userId, exerciseId, kind },
    orderBy: { value: "desc" },
  });
  if (existingBest && existingBest.value >= value) return;

  await prisma.exercisePersonalRecord.create({
    data: {
      userId,
      exerciseId,
      kind,
      value,
      weightKg: extra.weightKg ?? undefined,
      reps: extra.reps ?? undefined,
      setLogId: extra.setLogId,
      sessionId: extra.sessionId,
    },
  });
}
