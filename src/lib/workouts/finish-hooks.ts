import "server-only";
import { publishOnFinish } from "@/lib/social/publish";
import {
  syncMilestoneNotification,
  syncRecordNotification,
  syncWeekCompleteNotification,
} from "@/lib/social/achievement-notifications";

/**
 * What follows a finished workout outside the workout itself — publishing it
 * to the feed and the achievements log — in one place, so the workout actions
 * (lib/actions/workouts.ts) don't grow a line per feature. Each step runs in
 * its own try/catch: the workout is already saved, and a bookkeeping failure
 * must never look like a failed finish or stop the next step.
 */

export interface FinishContext {
  userId: string;
  sessionId: string;
  /** When the workout counts as done (a late save keeps its own day). */
  finishedAt: Date;
  now: Date;
  /** The milestone number this workout reached (recordWorkoutMilestone), or null. */
  milestone: number | null;
}

/**
 * After finishSession flipped a session to COMPLETED and recorded its PRs and
 * milestone: publish (the card lists the records), then the records, week and
 * milestone notifications. Returns the activity it published, if any.
 */
export async function afterFinish(ctx: FinishContext): Promise<{ activityId: string | null }> {
  let activityId: string | null = null;
  try {
    activityId = (await publishOnFinish(ctx.userId, ctx.sessionId, ctx.finishedAt))?.activityId ?? null;
  } catch (err) {
    console.error("Publish on finish failed", ctx.sessionId, err);
  }
  try {
    await syncRecordNotification(ctx.userId, ctx.sessionId);
  } catch (err) {
    console.error("Record notification failed", ctx.sessionId, err);
  }
  try {
    await syncWeekCompleteNotification(ctx.userId, ctx.sessionId, ctx.finishedAt, ctx.now);
  } catch (err) {
    console.error("Week-complete notification failed", ctx.sessionId, err);
  }
  if (ctx.milestone != null) {
    try {
      await syncMilestoneNotification(ctx.userId, ctx.sessionId, ctx.milestone);
    } catch (err) {
      console.error("Milestone notification failed", ctx.sessionId, err);
    }
  }
  return { activityId };
}

/**
 * After records were judged again — a corrected workout and the later ones
 * sharing an exercise with it, or the later ones after a delete (the deleted
 * workout's own rows go with it: Notification.sessionId cascades).
 */
export async function afterRescore(userId: string, sessionIds: readonly string[]): Promise<void> {
  for (const id of sessionIds) {
    try {
      await syncRecordNotification(userId, id);
    } catch (err) {
      console.error("Record notification failed", id, err);
    }
  }
}
