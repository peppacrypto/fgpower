import "server-only";
import { prisma } from "@/lib/db";
import { SHOWN_PR_KINDS } from "@/lib/training/personal-records-core";

export type ProgressPeriod = "4w" | "8w" | "3m" | "6m" | "1y" | "all";

export function periodStartDate(period: ProgressPeriod): Date | null {
  const now = new Date();
  switch (period) {
    case "4w":
      return new Date(now.getTime() - 28 * 86400_000);
    case "8w":
      return new Date(now.getTime() - 56 * 86400_000);
    case "3m":
      return new Date(now.getTime() - 90 * 86400_000);
    case "6m":
      return new Date(now.getTime() - 182 * 86400_000);
    case "1y":
      return new Date(now.getTime() - 365 * 86400_000);
    case "all":
      return null;
  }
}

export async function getProgressSummary(userId: string, period: ProgressPeriod) {
  const start = periodStartDate(period);
  const where = {
    userId,
    status: "COMPLETED" as const,
    ...(start ? { finishedAt: { gte: start } } : {}),
  };

  const [sessionCount, prRows, activeEnrollment] = await Promise.all([
    prisma.workoutSession.count({ where }),
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
      include: { program: { select: { name: true, durationWeeks: true } } },
    }),
  ]);

  // Consistency: completed sessions vs. expected (profile.daysPerWeek * weeks in period).
  const profile = await prisma.profile.findUnique({ where: { userId }, select: { daysPerWeek: true } });
  const weeks = start ? Math.max(1, (Date.now() - start.getTime()) / (7 * 86400_000)) : null;
  const expected = weeks && profile ? Math.round(weeks * profile.daysPerWeek) : null;
  const consistencyPct = expected && expected > 0 ? Math.min(100, Math.round((sessionCount / expected) * 100)) : null;

  return { sessionCount, recentPrs: latestRecordsPerExercise(prRows, 8), activeEnrollment, consistencyPct };
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

/** For each exercise the user has trained in the period, the first vs. most recent best weight (a simple, honest progress delta). */
export async function getExerciseProgressDeltas(userId: string, period: ProgressPeriod, limit = 6) {
  const start = periodStartDate(period);
  const logs = await prisma.workoutExerciseLog.findMany({
    where: {
      userId,
      session: { status: "COMPLETED", ...(start ? { finishedAt: { gte: start } } : {}) },
    },
    orderBy: { createdAt: "asc" },
    include: {
      exercise: { select: { id: true, namePt: true, slug: true } },
      sets: { where: { isCompleted: true, setType: "WORKING" } },
    },
  });

  const byExercise = new Map<string, { namePt: string; slug: string; weights: number[] }>();
  for (const log of logs) {
    const bestWeight = Math.max(0, ...log.sets.map((s) => s.weightKg ?? 0));
    if (bestWeight <= 0) continue;
    const entry = byExercise.get(log.exerciseId) ?? { namePt: log.exercise.namePt, slug: log.exercise.slug, weights: [] };
    entry.weights.push(bestWeight);
    byExercise.set(log.exerciseId, entry);
  }

  const deltas = Array.from(byExercise.values())
    .filter((e) => e.weights.length >= 2)
    .map((e) => ({
      namePt: e.namePt,
      slug: e.slug,
      firstKg: e.weights[0],
      lastKg: e.weights[e.weights.length - 1],
      deltaKg: Math.round((e.weights[e.weights.length - 1] - e.weights[0]) * 10) / 10,
    }))
    .filter((e) => e.deltaKg !== 0)
    .sort((a, b) => b.deltaKg - a.deltaKg)
    .slice(0, limit);

  return deltas;
}
