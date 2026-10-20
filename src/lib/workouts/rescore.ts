import "server-only";
import { prisma } from "@/lib/db";
import { checkAndRecordPersonalRecords } from "@/lib/training/personal-records";
import { buildWorkoutActivitySummary } from "@/lib/social/activity-summary";

/**
 * Re-judges the records of finished workouts — each against the workouts
 * finished before it (checkAndRecordPersonalRecords, idempotent) — dated on
 * their own finish, as the finish dates them. Run on a corrected workout and
 * on the later ones that share an exercise with it: a typo's "record" no
 * longer stands in their way, and a record measured against a deleted
 * workout is measured again. Each one's shared card is rebuilt after it (a
 * card lists the workout's records, and its totals after an edit), so the
 * feed never shows a record that no longer stands or misses one that does.
 */
export async function rescoreRecords(userId: string, sessionIds: string[]) {
  for (const id of sessionIds) {
    try {
      await checkAndRecordPersonalRecords(userId, id);
      const s = await prisma.workoutSession.findUnique({ where: { id }, select: { finishedAt: true } });
      if (s?.finishedAt) {
        await prisma.exercisePersonalRecord.updateMany({ where: { userId, sessionId: id }, data: { achievedAt: s.finishedAt } });
      }
    } catch (err) {
      // The correction is saved; a record bookkeeping failure must not look like a failed save.
      console.error("PR rescoring failed", id, err);
    }
    try {
      // Outside the rescoring's try: an edited workout's card still gets its corrected totals.
      await refreshSharedCard(id);
    } catch (err) {
      console.error("Shared card refresh failed", id, err);
    }
  }
}

/** A shared workout's card is built from its sets and records (activities.ts): rebuilt after a correction. */
async function refreshSharedCard(sessionId: string) {
  // Most rescored workouts were never shared: those load nothing.
  const session = await prisma.workoutSession.findFirst({
    where: { id: sessionId, activity: { isNot: null } },
    include: {
      exerciseLogs: { include: { exercise: true, sets: true }, orderBy: { sortOrder: "asc" } },
      records: { include: { exercise: true } },
      activity: { select: { id: true, showDetailedLoads: true } },
    },
  });
  if (!session?.activity) return;
  const summary = buildWorkoutActivitySummary(session, session.activity.showDetailedLoads);
  await prisma.activity.update({ where: { id: session.activity.id }, data: { summary: summary as never } });
}
