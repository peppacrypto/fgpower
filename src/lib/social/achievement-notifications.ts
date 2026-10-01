import "server-only";
import { prisma } from "@/lib/db";
import { getWeeklyStreak } from "@/lib/data/streak-data";
import { entryWeekWasTrained } from "@/lib/data/program-lifecycle";
import { countedWeeks } from "@/lib/programming/block-progress";
import { groupRecordsByExercise } from "@/lib/training/personal-records-core";
import { weekCounts } from "@/lib/training/streak";
import { startOfWeek } from "@/lib/training/week";
import { createNotification, notificationKey, retractNotification } from "./notifications";

/**
 * The user's own achievements in the notifications log (W-043, decision 4):
 * records, a week on target, the 10th/25th/50th/100th workout — created
 * already read (D-E: an achievements log, never the unread pip; the lifter
 * saw the same thing on the summary seconds earlier) through
 * createNotification, keyed notificationKey.records / .week / .milestone and
 * linked to the workout by sessionId (deleting the workout deletes the row).
 * finish-hooks.ts calls these after every finish and every rescore; each one
 * is idempotent. The copy is lib/social/notification-text.ts.
 */

/** How many exercise names a records row keeps (the copy shows two and "e mais N"). */
const NAMES_KEPT = 3;

/** What a PERSONAL_RECORD row stores. */
export interface RecordNotificationData {
  sessionId: string;
  /** Exercises with a record in the workout. */
  count: number;
  /** The first ones' names, in workout order. */
  exercises: string[];
}

/** What a PROGRAM_WEEK_COMPLETE row stores. */
export interface WeekNotificationData {
  /** São Paulo Monday day number of the week. */
  monday: number;
  done: number;
  target: number;
  deload: boolean;
  /** Weeks in a row, this one included. */
  streak: number;
  programName: string | null;
  /** The block's week as the summary counts it (0 = the entry week), when the week is a program's. */
  programWeek: number | null;
}

/** What a WORKOUT_MILESTONE row stores. */
export interface MilestoneNotificationData {
  count: number;
  sessionId: string;
}

/**
 * Brings the session's PERSONAL_RECORD row in line with its records: created
 * (read) when it has any shown record, its data updated when they change
 * (never re-armed, never moved in time), deleted when none is left.
 */
export async function syncRecordNotification(userId: string, sessionId: string): Promise<void> {
  const key = notificationKey.records(sessionId);
  const session = await prisma.workoutSession.findUnique({
    where: { id: sessionId },
    select: {
      userId: true,
      status: true,
      exerciseLogs: { orderBy: { sortOrder: "asc" }, select: { exerciseId: true } },
    },
  });
  if (!session || session.userId !== userId) return;

  const records =
    session.status === "COMPLETED"
      ? await prisma.exercisePersonalRecord.findMany({
          where: { userId, sessionId },
          select: { kind: true, exerciseId: true, exercise: { select: { namePt: true } } },
        })
      : [];
  const groups = groupRecordsByExercise(
    records,
    (r) => r.exerciseId,
    session.exerciseLogs.map((l) => l.exerciseId),
  );
  if (groups.length === 0) {
    await retractNotification(prisma, { recipientId: userId, dedupeKey: key, onlyUnread: false });
    return;
  }
  const data: RecordNotificationData = {
    sessionId,
    count: groups.length,
    exercises: groups.slice(0, NAMES_KEPT).map((g) => g.records[0].exercise.namePt),
  };
  await createNotification(prisma, {
    recipientId: userId,
    actorId: null,
    type: "PERSONAL_RECORD",
    dedupeKey: key,
    sessionId,
    data: { ...data },
    read: true,
    onDuplicate: "update",
  });
}

/**
 * One PROGRAM_WEEK_COMPLETE row per São Paulo week, the first time the week
 * counts (planned or applied deload weeks included: the streak's own rule,
 * which reads deloads through effectiveDeload). Nothing for a workout saved
 * into an already-closed week (finishedAt before this week).
 */
export async function syncWeekCompleteNotification(userId: string, sessionId: string, finishedAt: Date, now: Date): Promise<void> {
  if (finishedAt < startOfWeek(now)) return;
  const streak = await getWeeklyStreak(userId, now);
  const week = streak.thisWeek;
  if (!weekCounts(week)) return;

  const key = notificationKey.week(week.monday);
  // Already logged: nothing to load.
  const exists = await prisma.notification.count({ where: { recipientId: userId, dedupeKey: key } });
  if (exists > 0) return;

  const program = week.enrollmentId ? await weekProgram(userId, sessionId, week.enrollmentId) : null;
  const data: WeekNotificationData = {
    monday: week.monday,
    done: week.done,
    target: week.target,
    deload: week.deload === true,
    streak: streak.current,
    programName: program?.name ?? null,
    programWeek: program?.week ?? null,
  };
  await createNotification(
    prisma,
    { recipientId: userId, actorId: null, type: "PROGRAM_WEEK_COMPLETE", dedupeKey: key, sessionId, data: { ...data }, read: true },
    now,
  );
}

/** The program the week was judged by, and its week number as the summary shows it (from this workout, when it's that program's). */
async function weekProgram(userId: string, sessionId: string, enrollmentId: string) {
  const enrollment = await prisma.programEnrollment.findUnique({
    where: { id: enrollmentId },
    select: { id: true, userId: true, startedAt: true, program: { select: { name: true } } },
  });
  if (!enrollment || enrollment.userId !== userId) return null;
  const session = await prisma.workoutSession.findUnique({
    where: { id: sessionId },
    select: { enrollmentId: true, programWeek: true },
  });
  let week: number | null = null;
  if (session?.enrollmentId === enrollmentId && session.programWeek != null) {
    const entryTrained = await entryWeekWasTrained(prisma, { id: enrollment.id, userId, startedAt: enrollment.startedAt });
    week = countedWeeks(session.programWeek, enrollment.startedAt, entryTrained);
  }
  return { name: enrollment.program.name, week };
}

/** One WORKOUT_MILESTONE row per milestone number (`count` = 10 | 25 | 50 | 100), linked to the workout. */
export async function syncMilestoneNotification(userId: string, sessionId: string, count: number): Promise<void> {
  const data: MilestoneNotificationData = { count, sessionId };
  await createNotification(prisma, {
    recipientId: userId,
    actorId: null,
    type: "WORKOUT_MILESTONE",
    dedupeKey: notificationKey.milestone(count),
    sessionId,
    data: { ...data },
    read: true,
  });
}
