import { describe, expect, it } from "vitest";
import {
  blockEnds,
  blockProgress,
  countedWeeks,
  entryWeekEnd,
  programWeekNow,
  resumePoint,
  type BlockSession,
} from "./block-progress";

// São Paulo noon on a Monday and on a Friday (UTC−3).
const MONDAY = new Date("2026-09-21T15:00:00Z");
const FRIDAY = new Date("2026-09-25T15:00:00Z");
const DAY_MS = 86_400_000;
/** Noon (São Paulo) `days` after `from`'s. */
const plus = (from: Date, days: number) => new Date(from.getTime() + days * DAY_MS);

/** A workout of program week `programWeek`, finished at `at` (default: a Wednesday well past any entry week). */
const s = (programWeek: number, day: string | null, at: Date = plus(MONDAY, 30)): BlockSession => ({
  programWeek,
  programDayId: day,
  finishedAt: at,
});
const week = (w: number, ...days: string[]) => days.map((d) => s(w, d));

describe("blockProgress", () => {
  it("counts distinct days per week, capped at the target, with adherence over the weeks trained", () => {
    const p = blockProgress({
      currentWeek: 3,
      startedAt: MONDAY,
      durationWeeks: 13,
      daysPerWeek: 5,
      dayCount: 5,
      sessions: [
        ...week(1, "a", "b", "c", "d", "e"),
        ...week(2, "a", "b", "c", "a"), // a redo of A doesn't count twice
        ...week(3, "a", "b"),
      ],
    });
    expect(p).toMatchObject({ entryWeek: false, week: 3, weeks: 13, sessionsDone: 10, plannedSessions: 65 });
    // Weeks 1–2 ask for 10, week 3 (in progress) for the 2 done: 10 / 12.
    expect(p.adherencePct).toBe(83);
  });

  it("counts every session of a plan that repeats its days", () => {
    const p = blockProgress({
      currentWeek: 2,
      startedAt: MONDAY,
      durationWeeks: 8,
      daysPerWeek: 3,
      dayCount: 2,
      sessions: [...week(1, "a", "b", "a", "b"), ...week(2, "a")],
    });
    expect(p.sessionsDone).toBe(4); // week 1 capped at 3
    expect(p.plannedSessions).toBe(24);
    expect(p.adherencePct).toBe(100);
  });

  it("leaves a trained short entry week out of the weeks and the planned workouts", () => {
    const inEntry = [s(1, "a", FRIDAY), s(1, "b", plus(FRIDAY, 1))];
    const entry = blockProgress({
      currentWeek: 1,
      startedAt: FRIDAY,
      durationWeeks: 13,
      daysPerWeek: 5,
      dayCount: 5,
      sessions: inEntry,
    });
    expect(entry).toMatchObject({ entryWeek: true, week: 0, sessionsDone: 0, plannedSessions: 65, adherencePct: null });

    const later = blockProgress({
      currentWeek: 2,
      startedAt: FRIDAY,
      durationWeeks: 13,
      daysPerWeek: 5,
      dayCount: 5,
      sessions: [...inEntry, s(2, "c", plus(FRIDAY, 3))],
    });
    expect(later).toMatchObject({ entryWeek: false, week: 1, sessionsDone: 1, adherencePct: 100 });
  });

  it("activated Friday and first trained on Monday: that Monday is week 1, and its workouts count", () => {
    // Four full weeks of 3 workouts from the Monday after, no workout in the entry week.
    const sessions = [1, 2, 3, 4].flatMap((w) =>
      ["a", "b", "c"].map((d, i) => s(w, d, plus(FRIDAY, 3 + (w - 1) * 7 + i))),
    );
    const p = blockProgress({ currentWeek: 4, startedAt: FRIDAY, durationWeeks: 4, daysPerWeek: 3, dayCount: 3, sessions });
    expect(p).toMatchObject({ entryWeek: false, week: 4, sessionsDone: 12, plannedSessions: 12, adherencePct: 100 });
    // The same block on its first Monday: week 1, not "semana de entrada".
    const monday = blockProgress({
      currentWeek: 1,
      startedAt: FRIDAY,
      durationWeeks: 4,
      daysPerWeek: 3,
      dayCount: 3,
      sessions: sessions.slice(0, 1),
      now: plus(FRIDAY, 3),
    });
    expect(monday).toMatchObject({ entryWeek: false, week: 1, sessionsDone: 1 });
  });

  it("reads the entry week from the calendar while it lasts", () => {
    // Activated Friday, nothing done yet: still the entry week on Sunday, week 1 from Monday.
    const base = { currentWeek: 1, startedAt: FRIDAY, durationWeeks: 4, daysPerWeek: 3, dayCount: 3, sessions: [] };
    expect(blockProgress({ ...base, now: plus(FRIDAY, 2) })).toMatchObject({ entryWeek: true, week: 0 });
    expect(blockProgress({ ...base, now: plus(FRIDAY, 3) })).toMatchObject({ entryWeek: false, week: 1, sessionsDone: 0 });
    // Trained in the entry week, nothing since, on the Monday after: week 1 (Today's), not the entry week.
    const trained = { ...base, sessions: [s(1, "a", FRIDAY)] };
    expect(blockProgress(trained)).toMatchObject({ entryWeek: true, week: 0 });
    expect(blockProgress({ ...trained, now: plus(FRIDAY, 3) })).toMatchObject({ entryWeek: false, week: 1, sessionsDone: 0 });
  });

  it("reads the week as Today does: a week with nothing done yet is already the next one", () => {
    // 12 full weeks of GD 1 (Monday start), nothing yet in the 13th calendar week.
    const sessions = Array.from({ length: 12 }, (_, w) =>
      ["a", "b", "c", "d", "e"].map((d, i) => s(w + 1, d, plus(MONDAY, -84 + w * 7 + i))),
    ).flat();
    const base = { currentWeek: 12, startedAt: plus(MONDAY, -84), durationWeeks: 13, daysPerWeek: 5, dayCount: 5, sessions };
    expect(blockProgress({ ...base, now: plus(MONDAY, 6) })).toMatchObject({ week: 13, sessionsDone: 60, adherencePct: 100 });
    // Once this week has a workout, the counter itself says 13.
    const trained = { ...base, currentWeek: 13, sessions: [...sessions, s(13, "a", plus(MONDAY, 1))] };
    expect(blockProgress({ ...trained, now: plus(MONDAY, 1) })).toMatchObject({ week: 13, sessionsDone: 61 });
    // A finished block (no `now`) reads its counter.
    expect(blockProgress(base)).toMatchObject({ week: 12 });
    // Resumed ("Retomar da semana 7") after stopping in week 6: week 7 before its first workout.
    const six = sessions.filter((x) => (x.programWeek ?? 0) <= 6);
    expect(blockProgress({ ...base, currentWeek: 6, sessions: six, now: plus(MONDAY, 2) })).toMatchObject({ week: 7 });
  });

  it("programWeekNow: the counter, one ahead in a calendar week with nothing done yet", () => {
    const at = { startedAt: MONDAY, entryWeekTrained: false, now: plus(MONDAY, 14) };
    expect(programWeekNow({ ...at, currentWeek: 3, sessionsThisWeek: 0, trainedBefore: true })).toBe(4);
    expect(programWeekNow({ ...at, currentWeek: 3, sessionsThisWeek: 2, trainedBefore: true })).toBe(3);
    // Never trained: week 1.
    expect(programWeekNow({ ...at, currentWeek: 1, sessionsThisWeek: 0, trainedBefore: false })).toBe(1);
  });

  it("never runs past the block's duration", () => {
    const p = blockProgress({
      currentWeek: 14,
      startedAt: MONDAY,
      durationWeeks: 13,
      daysPerWeek: 1,
      dayCount: 1,
      sessions: Array.from({ length: 14 }, (_, i) => s(i + 1, "a")),
    });
    expect(p).toMatchObject({ week: 13, sessionsDone: 13, plannedSessions: 13, adherencePct: 100 });
  });

  it("has no adherence before the first workout, and no plan without a duration", () => {
    const p = blockProgress({ currentWeek: 1, startedAt: MONDAY, durationWeeks: null, daysPerWeek: 3, dayCount: 3, sessions: [] });
    expect(p).toMatchObject({ week: 1, weeks: null, sessionsDone: 0, plannedSessions: null, adherencePct: null });
  });
});

describe("the entry week", () => {
  it("ends on the Monday after a Thursday–Sunday activation, and there is none Monday–Wednesday", () => {
    expect(entryWeekEnd(FRIDAY)?.toISOString()).toBe("2026-09-28T03:00:00.000Z");
    expect(entryWeekEnd(plus(FRIDAY, 2))?.toISOString()).toBe("2026-09-28T03:00:00.000Z"); // Sunday
    expect(entryWeekEnd(MONDAY)).toBeNull();
    expect(entryWeekEnd(plus(MONDAY, 2))).toBeNull(); // Wednesday
  });

  it("takes a week number only when it was trained", () => {
    expect(countedWeeks(2, FRIDAY, true)).toBe(1);
    expect(countedWeeks(2, FRIDAY, false)).toBe(2);
    expect(countedWeeks(2, MONDAY, true)).toBe(2);
    const none = { sessionsThisWeek: 0, trainedBefore: false };
    expect(programWeekNow({ currentWeek: 1, startedAt: FRIDAY, entryWeekTrained: false, now: plus(FRIDAY, 1), ...none })).toBe(0);
    // Trained in the entry week, nothing yet on the Monday after: week 1.
    expect(
      programWeekNow({ currentWeek: 1, startedAt: FRIDAY, entryWeekTrained: true, now: plus(FRIDAY, 3), sessionsThisWeek: 0, trainedBefore: true }),
    ).toBe(1);
  });
});

describe("blockEnds", () => {
  const ends = (week: number, weekComplete: boolean, entryWeekTrained: boolean) =>
    blockEnds({ week, startedAt: FRIDAY, durationWeeks: 4, weekComplete, entryWeekTrained });

  it("ends a Friday-activated block after its 4th full week, whether or not the entry week was trained", () => {
    // Not trained in the entry week: the counter is at 4 in the 4th full week.
    expect(ends(4, false, false)).toBe(false);
    expect(ends(4, true, false)).toBe(true);
    expect(ends(5, false, false)).toBe(true);
    // Trained in it: the entry week is 1, the 4th full week is 5.
    expect(ends(4, true, true)).toBe(false);
    expect(ends(5, true, true)).toBe(true);
  });
});

describe("resumePoint", () => {
  const base = { startedAt: MONDAY, durationWeeks: 6, entryWeekTrained: false };

  it("picks up at the next week after a break, the same one within the week", () => {
    expect(resumePoint({ ...base, currentWeek: 3, trainedThisWeek: false })).toEqual({ week: 4, currentWeek: 3 });
    expect(resumePoint({ ...base, currentWeek: 3, trainedThisWeek: true })).toEqual({ week: 3, currentWeek: 3 });
  });

  it("counts from the first full week when the entry week wasn't trained", () => {
    // Activated Friday, trained 2 full weeks from Monday: the next week is 3.
    expect(resumePoint({ currentWeek: 2, startedAt: FRIDAY, durationWeeks: 4, trainedThisWeek: false, entryWeekTrained: false })).toEqual({
      week: 3,
      currentWeek: 2,
    });
    expect(resumePoint({ currentWeek: 3, startedAt: FRIDAY, durationWeeks: 4, trainedThisWeek: false, entryWeekTrained: true })).toEqual({
      week: 3,
      currentWeek: 3,
    });
  });

  it("resumes a block stopped in its last week at that week, with the counter one step back", () => {
    // Stopped in week 6 of 6, resumed a later week: the next workout counts in week 6 again.
    expect(resumePoint({ ...base, currentWeek: 6, trainedThisWeek: false })).toEqual({ week: 6, currentWeek: 5 });
    // Within the same calendar week, nothing to move.
    expect(resumePoint({ ...base, currentWeek: 6, trainedThisWeek: true })).toEqual({ week: 6, currentWeek: 6 });
    // With a trained entry week, the last week's counter is 7.
    expect(
      resumePoint({ currentWeek: 7, startedAt: FRIDAY, durationWeeks: 6, trainedThisWeek: false, entryWeekTrained: true }),
    ).toEqual({ week: 6, currentWeek: 6 });
  });
});
