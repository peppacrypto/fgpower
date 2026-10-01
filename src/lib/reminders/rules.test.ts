import { describe, expect, it } from "vitest";
import { dayNumberOf, mondayOf } from "@/lib/training/day-rotation";
import { startOfWeek } from "@/lib/training/week";
import {
  capsAllow,
  decideReminder,
  digestDayNo,
  isTrainingDay,
  notDueTodayUserIds,
  openPushHours,
  pushWindowState,
  reminderDeadline,
  settleDelivery,
  shouldPause,
  shouldResume,
  type ReminderContext,
} from "./rules";

/** A fixed São Paulo week: Monday 2026-09-28 (UTC-3, no DST). */
const MON = new Date("2026-09-28T03:00:00.000Z");
const DAY = 86_400_000;
const at = (day: number, h: number, m = 0) => new Date(MON.getTime() + day * DAY + h * 3_600_000 + m * 60_000);
const MON_NO = dayNumberOf(MON);
const SQS = new Set([1, 3, 5]);

function ctx(now: Date, patch: Partial<ReminderContext> = {}): ReminderContext {
  const w = new Date(now.getTime() - 3 * 3_600_000);
  return {
    todayNo: dayNumberOf(now),
    minutes: w.getUTCHours() * 60 + w.getUTCMinutes(),
    paused: false,
    pushHour: 18,
    hasDevice: true,
    hasPlan: true,
    plannedDays: SQS,
    enrollmentStartNo: MON_NO - 21,
    deload: false,
    nextIsToday: true,
    restToday: false,
    weekDone: false,
    trainedToday: false,
    startedToday: false,
    inProgress: false,
    openWorkout: null,
    sentAt: [],
    ...patch,
  };
}

describe("reminder rules", () => {
  it("anchors on São Paulo days", () => {
    expect(startOfWeek(at(2, 12)).getTime()).toBe(MON.getTime());
    expect(mondayOf(dayNumberOf(at(6, 23, 59)))).toBe(MON_NO);
  });

  it("caps: 1 a day and 3 a week, whatever the kind; only SENT times are passed", () => {
    expect(capsAllow([], at(0, 18))).toEqual({ ok: true });
    expect(capsAllow([at(0, 7, 5)], at(0, 18, 5))).toEqual({ ok: false, reason: "CAP_DAY" });
    expect(capsAllow([at(0, 7), at(2, 18), at(4, 18)], at(5, 18))).toEqual({ ok: false, reason: "CAP_WEEK" });
    // Last week's don't count; 2 this week leave room.
    expect(capsAllow([at(-3, 18), at(-2, 18), at(-1, 18), at(0, 18), at(1, 18)], at(2, 18))).toEqual({ ok: true });
    // 23:59 Sunday is still this week.
    expect(capsAllow([at(6, 23, 59)], at(7, 0, 1))).toEqual({ ok: true });
  });

  it("windows: the push hour + 2 h, never from 21:30", () => {
    expect(pushWindowState(18, 17 * 60 + 59)).toBe("before");
    expect(pushWindowState(18, 18 * 60)).toBe("in");
    expect(pushWindowState(18, 19 * 60 + 59)).toBe("in");
    expect(pushWindowState(18, 20 * 60)).toBe("after");
    expect(pushWindowState(20, 21 * 60 + 29)).toBe("in");
    expect(pushWindowState(20, 21 * 60 + 30)).toBe("after");
    expect(openPushHours(7 * 60 + 30)).toEqual([7]);
    expect(openPushHours(12 * 60)).toEqual([12]);
    expect(openPushHours(19 * 60 + 30)).toEqual([18]);
    expect(openPushHours(20 * 60 + 30)).toEqual([20]);
    expect(openPushHours(22 * 60)).toEqual([]);
  });

  it("the deadline is the São Paulo midnight ending the day after the send", () => {
    expect(reminderDeadline(at(0, 18, 5))).toEqual(at(2, 0));
    // 23:30 Monday in São Paulo is already Tuesday in UTC: still Wednesday 00:00 SP.
    expect(reminderDeadline(at(0, 23, 30))).toEqual(at(2, 0));
  });

  it("training days: planned weekdays from the start; catch-up days are rest days", () => {
    expect(isTrainingDay({ todayNo: MON_NO, plannedDays: SQS, enrollmentStartNo: MON_NO - 7 })).toBe(true);
    expect(isTrainingDay({ todayNo: MON_NO + 1, plannedDays: SQS, enrollmentStartNo: null })).toBe(false);
    expect(isTrainingDay({ todayNo: MON_NO + 2, plannedDays: SQS, enrollmentStartNo: MON_NO + 3 })).toBe(false);
  });

  it("the digest day: first planned day from the start, Monday without a schedule, none in deload", () => {
    expect(digestDayNo({ mondayNo: MON_NO, plannedDays: SQS, enrollmentStartNo: MON_NO - 30, deload: false })).toBe(MON_NO);
    expect(digestDayNo({ mondayNo: MON_NO, plannedDays: new Set([2, 4]), enrollmentStartNo: null, deload: false })).toBe(MON_NO + 1);
    expect(digestDayNo({ mondayNo: MON_NO, plannedDays: SQS, enrollmentStartNo: MON_NO + 1, deload: false })).toBe(MON_NO + 2);
    expect(digestDayNo({ mondayNo: MON_NO, plannedDays: SQS, enrollmentStartNo: MON_NO + 5, deload: false })).toBeNull();
    expect(digestDayNo({ mondayNo: MON_NO, plannedDays: new Set(), enrollmentStartNo: null, deload: false })).toBe(MON_NO);
    expect(digestDayNo({ mondayNo: MON_NO, plannedDays: SQS, enrollmentStartNo: null, deload: true })).toBeNull();
  });

  it("engaged vs ignored", () => {
    const base = { sentAt: at(0, 18), deadline: at(2, 0), clickedAt: null, workoutStartedAt: null, targetClosed: false };
    expect(settleDelivery(base, at(1, 12))).toBeNull();
    expect(settleDelivery(base, at(2, 0))).toEqual({ ignoredAt: at(2, 0) });
    expect(settleDelivery({ ...base, clickedAt: at(0, 19) }, at(3, 0))).toEqual({ engagedAt: at(0, 19) });
    expect(settleDelivery({ ...base, workoutStartedAt: at(1, 7) }, at(3, 0))).toEqual({ engagedAt: at(1, 7) });
    // A workout after the deadline doesn't make it engaged.
    expect(settleDelivery({ ...base, workoutStartedAt: at(2, 7) }, at(3, 0))).toEqual({ ignoredAt: at(3, 0) });
    expect(settleDelivery({ ...base, targetClosed: true }, at(1, 9))).toEqual({ engagedAt: at(1, 9) });
  });

  it("pause after 2 ignored in a row, unless a workout came between; resume on the next workout", () => {
    const ignored = (d: number) => ({ sentAt: at(d, 18), ignoredAt: at(d + 2, 0), engagedAt: null });
    const engaged = (d: number) => ({ sentAt: at(d, 18), ignoredAt: null, engagedAt: at(d, 19) });
    expect(shouldPause([ignored(2), ignored(0)], { lastWorkoutStartAt: null })).toBe(true);
    expect(shouldPause([ignored(2)], { lastWorkoutStartAt: null })).toBe(false);
    expect(shouldPause([ignored(2), engaged(0)], { lastWorkoutStartAt: null })).toBe(false);
    expect(shouldPause([ignored(2), ignored(0)], { lastWorkoutStartAt: at(1, 7) })).toBe(false);
    expect(shouldPause([ignored(2), ignored(0)], { lastWorkoutStartAt: at(-1, 7) })).toBe(true);
    expect(shouldResume({ pausedAt: at(4, 18), lastWorkoutStartAt: at(4, 19) })).toBe(true);
    expect(shouldResume({ pausedAt: at(4, 18), lastWorkoutStartAt: at(3, 19) })).toBe(false);
    expect(shouldResume({ pausedAt: null, lastWorkoutStartAt: at(3, 19) })).toBe(false);
  });

  describe("decideReminder", () => {
    it("training day: every skip reason, in order", () => {
      const now = at(2, 18, 5);
      expect(decideReminder("TRAINING_DAY", ctx(now), now)).toEqual({ action: "send" });
      expect(decideReminder("TRAINING_DAY", ctx(at(2, 17)), at(2, 17))).toEqual({ action: "wait" });
      expect(decideReminder("TRAINING_DAY", ctx(at(2, 20, 1)), at(2, 20, 1))).toEqual({ action: "wait" });
      const skip = (patch: Partial<ReminderContext>) => decideReminder("TRAINING_DAY", ctx(now, patch), now);
      expect(skip({ hasDevice: false })).toEqual({ action: "wait" });
      expect(skip({ paused: true })).toEqual({ action: "skip", reason: "PAUSED" });
      expect(skip({ hasPlan: false })).toEqual({ action: "skip", reason: "NO_PLAN" });
      expect(skip({ deload: true })).toEqual({ action: "skip", reason: "DELOAD" });
      expect(skip({ plannedDays: new Set([1, 5]) })).toEqual({ action: "skip", reason: "REST_DAY" });
      expect(skip({ weekDone: true })).toEqual({ action: "skip", reason: "WEEK_DONE" });
      expect(skip({ trainedToday: true })).toEqual({ action: "skip", reason: "TRAINED_TODAY" });
      expect(skip({ startedToday: true })).toEqual({ action: "skip", reason: "STARTED_TODAY" });
      expect(skip({ inProgress: true })).toEqual({ action: "skip", reason: "IN_PROGRESS" });
      expect(skip({ restToday: true })).toEqual({ action: "skip", reason: "REST_DAY" });
      expect(skip({ sentAt: [at(2, 7, 5)] })).toEqual({ action: "skip", reason: "CAP_DAY" });
      expect(skip({ sentAt: [at(0, 7), at(0, 18), at(1, 18)] })).toEqual({ action: "skip", reason: "CAP_WEEK" });
    });

    it("digest: its day between 07:00 and 11:00, late after, deload never", () => {
      const d = (now: Date, patch: Partial<ReminderContext> = {}) => decideReminder("WEEKLY_DIGEST", ctx(now, patch), now);
      expect(d(at(0, 6, 59))).toEqual({ action: "wait" });
      expect(d(at(0, 7, 5))).toEqual({ action: "send" });
      expect(d(at(0, 11))).toEqual({ action: "skip", reason: "LATE" });
      expect(d(at(1, 7, 5))).toEqual({ action: "skip", reason: "LATE" });
      expect(d(at(0, 7, 5), { plannedDays: new Set([3]) })).toEqual({ action: "wait" });
      expect(d(at(2, 7, 5), { plannedDays: new Set([3]) })).toEqual({ action: "send" });
      expect(d(at(0, 7, 5), { deload: true })).toEqual({ action: "skip", reason: "DELOAD" });
      expect(d(at(0, 7, 5), { paused: true })).toEqual({ action: "skip", reason: "PAUSED" });
      // The digest counts toward the caps (and is capped like any other).
      expect(d(at(0, 7, 5), { sentAt: [at(0, 7)] })).toEqual({ action: "skip", reason: "CAP_DAY" });
      // No program and no preferred days: Monday.
      expect(d(at(0, 8), { hasPlan: false, plannedDays: new Set(), enrollmentStartNo: null })).toEqual({ action: "send" });
    });

    it("open workout: 3–20 h idle, 07:00–21:30, the day it was started counts as a training day", () => {
      const open = (startDay: number, lastH: number) => ({
        sessionId: "s1",
        startedNo: MON_NO + startDay,
        lastActivityAt: at(startDay, lastH),
      });
      const d = (now: Date, patch: Partial<ReminderContext>) => decideReminder("OPEN_WORKOUT", ctx(now, patch), now);
      expect(d(at(2, 12), { openWorkout: open(2, 10) })).toEqual({ action: "wait" });
      expect(d(at(2, 13, 5), { openWorkout: open(2, 10) })).toEqual({ action: "send" });
      // Tuesday is a rest day in SEG·QUA·SEX, but it was started today.
      expect(d(at(1, 13, 5), { openWorkout: open(1, 10) })).toEqual({ action: "send" });
      // Started Monday evening, Tuesday morning: a rest day.
      expect(d(at(1, 8), { openWorkout: open(0, 19) })).toEqual({ action: "skip", reason: "REST_DAY" });
      expect(d(at(2, 22), { openWorkout: open(2, 18) })).toEqual({ action: "wait" });
      expect(d(at(3, 16), { openWorkout: open(2, 18) })).toEqual({ action: "skip", reason: "LATE" });
      expect(d(at(2, 13, 5), { openWorkout: open(2, 10), deload: true })).toEqual({ action: "skip", reason: "DELOAD" });
      expect(d(at(2, 13, 5), { openWorkout: null })).toEqual({ action: "wait" });
    });
  });
});

describe("the digest's not-due-today memo", () => {
  it("names today's not-due users for the candidate query and forgets other days", () => {
    const memo = new Map([
      ["WEEKLY_DIGEST:ana", "2026-09-28"],
      ["WEEKLY_DIGEST:bia", "2026-09-28"],
      ["WEEKLY_DIGEST:caio", "2026-09-27"],
    ]);
    expect(notDueTodayUserIds(memo, "2026-09-28")).toEqual(["ana", "bia"]);
    // Yesterday's entry is gone: the map can't grow day after day.
    expect([...memo.keys()]).toEqual(["WEEKLY_DIGEST:ana", "WEEKLY_DIGEST:bia"]);
    // A new day: nobody is left out until the tick finds them not due again.
    expect(notDueTodayUserIds(memo, "2026-09-29")).toEqual([]);
    expect(memo.size).toBe(0);
  });
});
