import "server-only";

/**
 * The user's own achievements in the notifications log (W-043, decision 4):
 * records, a week on target, the 10th/25th/50th/100th workout — created
 * already read through lib/social/notifications.ts createNotification (keys:
 * notificationKey.records / .week / .milestone). Owned by the social inbox
 * cluster (C1).
 *
 * Phase 0 stubs with the final signatures: finish-hooks.ts calls them after
 * every finish and every rescore. They write nothing yet.
 */

/**
 * Brings the session's PERSONAL_RECORD row in line with its records: created
 * (read) when it has any shown record, its data updated when they change
 * (never re-armed), deleted when none is left.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Phase 0 stub (C1 implements W-043)
export async function syncRecordNotification(userId: string, sessionId: string): Promise<void> {}

/**
 * One PROGRAM_WEEK_COMPLETE row per São Paulo week, the first time the week
 * counts (planned or applied deload weeks included). Nothing for a workout
 * saved into an already-closed week (finishedAt before this week).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Phase 0 stub (C1 implements W-043)
export async function syncWeekCompleteNotification(userId: string, sessionId: string, finishedAt: Date, now: Date): Promise<void> {}

/** One WORKOUT_MILESTONE row per milestone number (`count` = 10 | 25 | 50 | 100), linked to the workout. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Phase 0 stub (C1 implements D-F)
export async function syncMilestoneNotification(userId: string, sessionId: string, count: number): Promise<void> {}
