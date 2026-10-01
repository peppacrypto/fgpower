import { dayNumberOf, mondayOf, weekdayOfDayNo } from "@/lib/training/day-rotation";
import { wallClock, zonedMidnight } from "@/lib/training/week";

/**
 * Decision 8, measurable (W-017): when a reminder may go out. São Paulo wall
 * clock, Monday-start weeks. Pure — the engine loads the facts
 * (lib/reminders/context) and writes what these functions decide.
 *
 * - A reminder is a SENT delivery: the weekly e-mail digest, the training-day
 *   push or the open-workout push. One push is one reminder however many
 *   devices it reaches. SKIPPED and FAILED never count.
 * - At most 1 a day and 3 a week, all kinds together.
 * - Never on a rest day, never in a deload week (planned or applied).
 * - Two ignored in a row pause them (silently) until the next workout.
 */

export type ReminderKindName = "WEEKLY_DIGEST" | "TRAINING_DAY" | "OPEN_WORKOUT";

export type SkipReason =
  | "PAUSED"
  | "DELOAD"
  | "REST_DAY"
  | "NO_PLAN"
  | "TRAINED_TODAY"
  | "STARTED_TODAY"
  | "IN_PROGRESS"
  | "WEEK_DONE"
  | "CAP_DAY"
  | "CAP_WEEK"
  | "LATE"
  | "NOT_DIGEST_DAY"
  | "NO_DEVICE"
  | "EMAIL_OFF";

export const REMINDER_CAP_DAY = 1;
export const REMINDER_CAP_WEEK = 3;
export const IGNORED_TO_PAUSE = 2;
/** The hours the training-day push can be set to (Settings chips). */
export const PUSH_HOURS = [7, 12, 18, 20] as const;
export type PushHour = (typeof PUSH_HOURS)[number];
export const DEFAULT_PUSH_HOUR: PushHour = 18;
/** The training-day push goes out within 2 h of its hour. */
export const PUSH_WINDOW_MINUTES = 120;
/** The digest's window on its day. */
export const DIGEST_FROM_MINUTES = 7 * 60;
export const DIGEST_UNTIL_MINUTES = 11 * 60;
/** Nothing is sent from 21:30 to 07:00. */
export const DAY_FROM_MINUTES = 7 * 60;
export const QUIET_FROM_MINUTES = 21 * 60 + 30;
/** An open workout is worth a reminder 3 to 20 hours after the last set typed. */
export const OPEN_WORKOUT_AFTER_MS = 3 * 3_600_000;
export const OPEN_WORKOUT_UNTIL_MS = 20 * 3_600_000;

export function isPushHour(hour: number): hour is PushHour {
  return (PUSH_HOURS as readonly number[]).includes(hour);
}

/** Minutes since São Paulo midnight. */
export function spMinutes(now: Date): number {
  const w = wallClock(now);
  return w.hour * 60 + w.minute;
}

/** The São Paulo midnight that ends the day AFTER the send day: engaged by then, or ignored. */
export function reminderDeadline(sentAt: Date): Date {
  const w = wallClock(sentAt);
  return zonedMidnight(w.year, w.month - 1, w.day + 2);
}

/** Where `minutes` stands against the training-day push window of `hour` ([h:00, min(h+2h, 21:30))). */
export function pushWindowState(hour: number, minutes: number): "before" | "in" | "after" {
  const from = hour * 60;
  const until = Math.min(from + PUSH_WINDOW_MINUTES, QUIET_FROM_MINUTES);
  if (minutes < from) return "before";
  return minutes < until ? "in" : "after";
}

/** The push hours whose window is open at `minutes` (the engine's candidate prefilter). */
export function openPushHours(minutes: number): PushHour[] {
  return PUSH_HOURS.filter((h) => pushWindowState(h, minutes) === "in");
}

/**
 * A training day for reminders: a planned weekday of the user's week, on or
 * after the program's start. Catch-up days and the entry week's unplanned
 * days are rest days here (the strict reading of "never on a rest day").
 */
export function isTrainingDay(p: {
  todayNo: number;
  plannedDays: ReadonlySet<number>;
  enrollmentStartNo: number | null;
}): boolean {
  if (p.enrollmentStartNo != null && p.todayNo < p.enrollmentStartNo) return false;
  return p.plannedDays.has(weekdayOfDayNo(p.todayNo));
}

/**
 * The digest's day this week: the first planned weekday on or after the
 * program's start; Monday with no schedule at all; none in a deload week, or
 * when no planned day of the week is left after the start.
 */
export function digestDayNo(p: {
  mondayNo: number;
  plannedDays: ReadonlySet<number>;
  enrollmentStartNo: number | null;
  deload: boolean;
}): number | null {
  if (p.deload) return null;
  if (p.plannedDays.size === 0) return p.mondayNo;
  for (let d = p.mondayNo; d < p.mondayNo + 7; d++) {
    if (p.enrollmentStartNo != null && d < p.enrollmentStartNo) continue;
    if (p.plannedDays.has(weekdayOfDayNo(d))) return d;
  }
  return null;
}

/** Room for one more reminder: none sent today, fewer than 3 this week (`sentAt` = SENT times, any kind). */
export function capsAllow(sentAt: readonly Date[], now: Date): { ok: true } | { ok: false; reason: "CAP_DAY" | "CAP_WEEK" } {
  const todayNo = dayNumberOf(now);
  const mondayNo = mondayOf(todayNo);
  const days = sentAt.map(dayNumberOf);
  if (days.filter((d) => d === todayNo).length >= REMINDER_CAP_DAY) return { ok: false, reason: "CAP_DAY" };
  if (days.filter((d) => d >= mondayNo && d < mondayNo + 7).length >= REMINDER_CAP_WEEK) {
    return { ok: false, reason: "CAP_WEEK" };
  }
  return { ok: true };
}

/**
 * How a SENT reminder settles: engaged when its link was opened or a workout
 * was started before the deadline (for an open-workout reminder, also when
 * that workout left IN_PROGRESS); ignored once the deadline passed without
 * either; still open (null) otherwise.
 */
export function settleDelivery(
  d: { sentAt: Date; deadline: Date; clickedAt: Date | null; workoutStartedAt: Date | null; targetClosed: boolean },
  now: Date,
): { engagedAt: Date } | { ignoredAt: Date } | null {
  const marks = [d.clickedAt, d.workoutStartedAt && d.workoutStartedAt <= d.deadline ? d.workoutStartedAt : null].filter(
    (t): t is Date => t != null && t >= d.sentAt,
  );
  if (d.targetClosed && now <= d.deadline) marks.push(now);
  if (marks.length > 0) return { engagedAt: new Date(Math.min(...marks.map((t) => t.getTime()))) };
  if (now >= d.deadline) return { ignoredAt: now };
  return null;
}

/**
 * Pause after the two most recent SENT reminders since the last resume were
 * both ignored — unless a workout was started since the earlier one went out.
 * `recent` is newest first.
 */
export function shouldPause(
  recent: readonly { sentAt: Date; ignoredAt: Date | null; engagedAt: Date | null }[],
  p: { lastWorkoutStartAt: Date | null },
): boolean {
  if (recent.length < IGNORED_TO_PAUSE) return false;
  const lastTwo = recent.slice(0, IGNORED_TO_PAUSE);
  if (!lastTwo.every((d) => d.ignoredAt != null && d.engagedAt == null)) return false;
  const earlier = lastTwo[lastTwo.length - 1];
  return !(p.lastWorkoutStartAt && p.lastWorkoutStartAt > earlier.sentAt);
}

const DIGEST_MEMO_PREFIX = "WEEKLY_DIGEST:";

/**
 * The users the tick already found with no digest due today (their digest
 * day comes later this week), from its memo ("WEEKLY_DIGEST:<user>" → day
 * key): left out of the candidate query itself, so a few hundred of them —
 * the query takes at most MAX_USERS — can't crowd out the users whose day
 * it is. Entries of other days are dropped (the memo lives for the process).
 */
export function notDueTodayUserIds(memo: Map<string, string>, todayKey: string): string[] {
  const ids: string[] = [];
  for (const [key, day] of memo) {
    if (day !== todayKey) memo.delete(key);
    else if (key.startsWith(DIGEST_MEMO_PREFIX)) ids.push(key.slice(DIGEST_MEMO_PREFIX.length));
  }
  return ids;
}

/** A paused user comes back with the first workout started after the pause. */
export function shouldResume(p: { pausedAt: Date | null; lastWorkoutStartAt: Date | null }): boolean {
  return p.pausedAt != null && p.lastWorkoutStartAt != null && p.lastWorkoutStartAt > p.pausedAt;
}

/** What the engine knows about one user at `now` (lib/reminders/context loads it). */
export interface ReminderContext {
  todayNo: number;
  /** São Paulo minutes of `now`. */
  minutes: number;
  paused: boolean;
  pushHour: number;
  /** At least one subscribed device. */
  hasDevice: boolean;
  /** Program week facts (Today's getUpcomingPlan). */
  hasPlan: boolean;
  /** Weekdays (0 = Sunday) the user trains on: the program's, else the profile's preferred days. */
  plannedDays: ReadonlySet<number>;
  enrollmentStartNo: number | null;
  /** A deload week (planned or applied: effectiveDeload). */
  deload: boolean;
  /** Today's hero suggests training today. */
  nextIsToday: boolean;
  restToday: boolean;
  /** This week already counts (done, or counted through another program). */
  weekDone: boolean;
  /** A workout was finished today. */
  trainedToday: boolean;
  /** A workout was started today (any status). */
  startedToday: boolean;
  /** A workout is open (any day). */
  inProgress: boolean;
  /** The open workout the OPEN_WORKOUT reminder is about. */
  openWorkout: { sessionId: string; startedNo: number; lastActivityAt: Date } | null;
  /** SENT reminders of this week (any kind), for the caps. */
  sentAt: Date[];
}

export type Decision = { action: "send" } | { action: "skip"; reason: SkipReason } | { action: "wait" };

const skip = (reason: SkipReason): Decision => ({ action: "skip", reason });
const WAIT: Decision = { action: "wait" };

/**
 * One kind for one user now. "send" and "skip" are final (the engine writes a
 * row, so they are never re-evaluated for that period); "wait" writes nothing
 * (not yet due, or not due at all).
 */
export function decideReminder(kind: ReminderKindName, ctx: ReminderContext, now: Date): Decision {
  const caps = () => {
    const c = capsAllow(ctx.sentAt, now);
    return c.ok ? ({ action: "send" } as Decision) : skip(c.reason);
  };

  if (kind === "WEEKLY_DIGEST") {
    const day = digestDayNo({
      mondayNo: mondayOf(ctx.todayNo),
      plannedDays: ctx.plannedDays,
      enrollmentStartNo: ctx.hasPlan ? ctx.enrollmentStartNo : null,
      deload: ctx.deload,
    });
    if (ctx.deload) return skip("DELOAD");
    if (day == null) return skip("NOT_DIGEST_DAY");
    if (ctx.todayNo < day) return WAIT;
    if (ctx.todayNo > day || ctx.minutes >= DIGEST_UNTIL_MINUTES) return skip("LATE");
    if (ctx.minutes < DIGEST_FROM_MINUTES) return WAIT;
    if (ctx.paused) return skip("PAUSED");
    return caps();
  }

  if (!ctx.hasDevice) return WAIT;

  if (kind === "OPEN_WORKOUT") {
    const open = ctx.openWorkout;
    if (!open) return WAIT;
    const idle = now.getTime() - open.lastActivityAt.getTime();
    if (idle > OPEN_WORKOUT_UNTIL_MS) return skip("LATE");
    if (idle < OPEN_WORKOUT_AFTER_MS) return WAIT;
    if (ctx.minutes < DAY_FROM_MINUTES || ctx.minutes >= QUIET_FROM_MINUTES) return WAIT;
    if (ctx.paused) return skip("PAUSED");
    if (ctx.deload) return skip("DELOAD");
    // The day it was started counts as a training day; with no schedule at all nothing is a rest day.
    const trainingDay =
      open.startedNo === ctx.todayNo ||
      ctx.plannedDays.size === 0 ||
      isTrainingDay({ todayNo: ctx.todayNo, plannedDays: ctx.plannedDays, enrollmentStartNo: ctx.enrollmentStartNo });
    if (!trainingDay) return skip("REST_DAY");
    return caps();
  }

  // TRAINING_DAY
  const window = pushWindowState(ctx.pushHour, ctx.minutes);
  if (window !== "in") return WAIT;
  if (ctx.paused) return skip("PAUSED");
  if (!ctx.hasPlan) return skip("NO_PLAN");
  if (ctx.deload) return skip("DELOAD");
  if (!isTrainingDay({ todayNo: ctx.todayNo, plannedDays: ctx.plannedDays, enrollmentStartNo: ctx.enrollmentStartNo })) {
    return skip("REST_DAY");
  }
  if (ctx.weekDone) return skip("WEEK_DONE");
  if (ctx.trainedToday) return skip("TRAINED_TODAY");
  if (ctx.startedToday) return skip("STARTED_TODAY");
  if (ctx.inProgress) return skip("IN_PROGRESS");
  if (!ctx.nextIsToday || ctx.restToday) return skip("REST_DAY");
  return caps();
}
