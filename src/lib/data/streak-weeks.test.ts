import { describe, expect, it } from "vitest";
import { thisWeekRule, programWeekView } from "@/lib/training/week-guidance";
import { dayNumberOf, mondayOf } from "@/lib/training/day-rotation";
import { streakWeeksFrom, summarizeStreak, type StreakEnrollment, type StreakSession } from "./streak-weeks";

// São Paulo is UTC−3: 15:00Z is midday there. 2026-09-28 is a Monday.
const at = (iso: string) => new Date(`${iso}T15:00:00Z`);
const addDays = (iso: string, n: number) => new Date(at(iso).getTime() + n * 86_400_000);

const days = ["A", "B", "C"].map((name, i) => ({ id: `d${i}`, dayIndex: i, name: `Sessão ${name}`, exerciseCount: 5 }));
const enrollment = (startedAt: Date, extra: Partial<StreakEnrollment["program"]> = {}): StreakEnrollment => ({
  id: "e1",
  startedAt,
  endedAt: null,
  program: { daysPerWeek: 3, durationWeeks: 8, weeklyGuidance: [], templateSlug: null, days, ...extra },
});
const session = (finishedAt: Date, day: number, programWeek = 1): StreakSession => ({
  finishedAt,
  enrollmentId: "e1",
  programDayId: `d${day}`,
  programDayIndex: day,
  name: `Sessão ${"ABC"[day]}`,
  programWeek,
});
/** Three workouts (A, B, C) in the week starting `monday`, Mon/Wed/Fri. */
const fullWeek = (monday: string, week: number) => [0, 1, 2].map((d) => session(addDays(monday, d * 2), d, week));

describe("weekly streak weeks", () => {
  it("counts consecutive weeks that met the program's target, with the record", () => {
    const sessions = [
      ...fullWeek("2026-08-31", 1),
      ...fullWeek("2026-09-07", 2),
      // A redo of A doesn't make up for C: 2 of 3.
      session(at("2026-09-14"), 0, 3),
      session(at("2026-09-15"), 0, 3),
      session(at("2026-09-16"), 1, 3),
      ...fullWeek("2026-09-21", 4),
    ];
    const rows = streakWeeksFrom({ sessions, enrollments: [enrollment(at("2026-08-31"))], profileDaysPerWeek: 3, now: at("2026-09-29") });
    expect(rows.weeks.map((w) => [w.done, w.target, w.met])).toEqual([
      [3, 3, true],
      [3, 3, true],
      [2, 3, false],
      [3, 3, true],
    ]);
    const s = summarizeStreak(rows);
    expect(s).toMatchObject({ current: 1, best: 2, remaining: 3, freeWeekAvailable: false });
  });

  it("an open week never breaks the streak; once met it extends it", () => {
    const sessions = [...fullWeek("2026-09-14", 1), ...fullWeek("2026-09-21", 2), session(at("2026-09-28"), 0, 3)];
    const open = summarizeStreak(
      streakWeeksFrom({ sessions, enrollments: [enrollment(at("2026-09-14"))], profileDaysPerWeek: 3, now: at("2026-10-01") }),
    );
    expect(open).toMatchObject({ current: 2, remaining: 2 });
    const met = summarizeStreak(
      streakWeeksFrom({
        sessions: [...sessions, session(at("2026-09-30"), 1, 3), session(at("2026-10-01"), 2, 3)],
        enrollments: [enrollment(at("2026-09-14"))],
        profileDaysPerWeek: 3,
        now: at("2026-10-01"),
      }),
    );
    expect(met).toMatchObject({ current: 3, remaining: 0 });
  });

  it("a Thursday–Sunday entry week aims at the days left", () => {
    // Started Saturday 26 Sep: 2 days left; one workout on Sunday doesn't meet 2, two do.
    const rows = streakWeeksFrom({
      sessions: [session(at("2026-09-26"), 0), session(at("2026-09-27"), 1)],
      enrollments: [enrollment(at("2026-09-26"))],
      profileDaysPerWeek: 3,
      now: at("2026-09-27"),
    });
    expect(rows.thisWeek).toMatchObject({ target: 2, done: 2, met: true });
  });

  it("a planned deload week counts with any workout", () => {
    const guidance = [
      { week: 1, rirTarget: 2, notePt: "", setsNotePt: "" },
      { week: 2, rirTarget: 4, notePt: "", setsNotePt: "Deload: metade das séries." },
    ];
    const rows = streakWeeksFrom({
      sessions: [...fullWeek("2026-09-14", 1), session(at("2026-09-22"), 0, 2)],
      enrollments: [enrollment(at("2026-09-14"), { weeklyGuidance: guidance })],
      profileDaysPerWeek: 3,
      now: at("2026-09-29"),
    });
    expect(rows.weeks[1]).toMatchObject({ done: 1, met: false, deload: true, trained: true });
    expect(summarizeStreak(rows).current).toBe(2);
    // Before its first workout, this week's deload is known from the week counter: one workout will do.
    const upcoming = streakWeeksFrom({
      sessions: fullWeek("2026-09-14", 1),
      enrollments: [{ ...enrollment(at("2026-09-14"), { weeklyGuidance: guidance }), currentWeek: 1 }],
      profileDaysPerWeek: 3,
      now: at("2026-09-24"),
    });
    expect(upcoming.thisWeek).toMatchObject({ deload: true, trained: false });
    expect(summarizeStreak(upcoming).remaining).toBe(1);
  });
  it("a week the user applied a deload to counts with any workout (lib/training/deload)", () => {
    const applied = mondayOf(dayNumberOf(at("2026-09-21")));
    const rows = streakWeeksFrom({
      sessions: [...fullWeek("2026-09-14", 1), session(at("2026-09-22"), 0, 2)],
      enrollments: [{ ...enrollment(at("2026-09-14")), deloadMondays: [applied] }],
      profileDaysPerWeek: 3,
      now: at("2026-09-29"),
    });
    expect(rows.weeks[1]).toMatchObject({ done: 1, met: false, deload: true, trained: true });
    expect(summarizeStreak(rows).current).toBe(2);
    // Only that week: the one before is judged as usual.
    expect(rows.weeks[0]).toMatchObject({ deload: false });
  });

  it("without a program, every workout counts against the profile's days per week", () => {
    const loose = (d: Date): StreakSession => ({ finishedAt: d, enrollmentId: null, programDayId: null, programDayIndex: null, name: "Livre", programWeek: null });
    const rows = streakWeeksFrom({
      sessions: [loose(at("2026-09-21")), loose(at("2026-09-23"))],
      enrollments: [],
      profileDaysPerWeek: 2,
      now: at("2026-09-28"),
    });
    expect(rows.weeks).toEqual([expect.objectContaining({ done: 2, target: 2, met: true, enrollmentId: null })]);
    expect(rows.thisWeek).toMatchObject({ done: 0, met: false });
  });

  it("a free week is available after 8 weeks of streak, and the summary says so", () => {
    const sessions = Array.from({ length: 8 }, (_, i) => fullWeek(addDays("2026-08-03", i * 7).toISOString().slice(0, 10), i + 1)).flat();
    const s = summarizeStreak(
      streakWeeksFrom({ sessions, enrollments: [enrollment(at("2026-08-03"))], profileDaysPerWeek: 3, now: at("2026-10-01") }),
    );
    expect(s).toMatchObject({ current: 8, freeWeekAvailable: true });
  });

  describe("the entry week (a Thursday–Sunday activation)", () => {
    // GD-like: five days, five a week.
    const five = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"].map((name, i) => ({ id: `g${i}`, dayIndex: i, name, exerciseCount: 6 }));
    const program = (extra: Partial<StreakEnrollment["program"]> = {}): StreakEnrollment["program"] => ({
      daysPerWeek: 5,
      durationWeeks: 13,
      weeklyGuidance: [],
      templateSlug: "gd-1",
      days: five,
      ...extra,
    });
    const gd = (id: string, startedAt: Date, endedAt: Date | null = null): StreakEnrollment => ({ id, startedAt, endedAt, program: program() });
    const workout = (enrollmentId: string, finishedAt: Date, day: number, programWeek = 1): StreakSession => ({
      finishedAt,
      enrollmentId,
      programDayId: `g${day}`,
      programDayIndex: day,
      name: five[day].name,
      programWeek,
    });
    const gdWeek = (id: string, monday: string, week: number) => [0, 1, 2, 3, 4].map((d) => workout(id, addDays(monday, d), d, week));

    it("aims at the days from the activation day to Sunday — a target that doesn't shrink as the week goes by", () => {
      // Activated Thursday 24 Sep, trained Thursday and Friday; seen on Sunday: 2 of 4, not "1/1".
      const rows = streakWeeksFrom({
        sessions: [workout("a", at("2026-09-24"), 0), workout("a", at("2026-09-25"), 1)],
        enrollments: [gd("a", at("2026-09-24"))],
        profileDaysPerWeek: 5,
        now: at("2026-09-27"),
      });
      expect(rows.thisWeek).toMatchObject({ done: 2, target: 4, met: false, neutral: true });
      // Seen on Friday, the same target.
      const friday = streakWeeksFrom({
        sessions: [workout("a", at("2026-09-24"), 0), workout("a", at("2026-09-25"), 1)],
        enrollments: [gd("a", at("2026-09-24"))],
        profileDaysPerWeek: 5,
        now: at("2026-09-25"),
      });
      expect(friday.thisWeek).toMatchObject({ done: 2, target: 4 });
    });

    it("never cuts the count to the cap: two workouts on a Sunday start are two", () => {
      const rows = streakWeeksFrom({
        sessions: [workout("a", at("2026-09-27"), 0), workout("a", addDays("2026-09-27", 0.1), 1)],
        enrollments: [gd("a", at("2026-09-27"))],
        profileDaysPerWeek: 5,
        now: addDays("2026-09-27", 0.2),
      });
      expect(rows.thisWeek).toMatchObject({ done: 2, target: 1, met: true });
    });

    it("short of its target, it's neutral: the run before it stands", () => {
      // Three full GD 1 weeks, then GD Adaptação from Thursday 17 Sep with one workout; nothing this week yet.
      const sessions = [
        ...gdWeek("g1", "2026-08-24", 1),
        ...gdWeek("g1", "2026-08-31", 2),
        ...gdWeek("g1", "2026-09-07", 3),
        workout("ad", at("2026-09-17"), 0),
      ];
      const enrollments = [gd("g1", at("2026-08-24"), addDays("2026-09-17", -0.1)), gd("ad", at("2026-09-17"))];
      const rows = streakWeeksFrom({ sessions, enrollments, profileDaysPerWeek: 5, now: at("2026-09-27") });
      expect(rows.weeks[rows.weeks.length - 1]).toMatchObject({ enrollmentId: "ad", done: 1, target: 4, met: false, neutral: true });
      const s = summarizeStreak(rows);
      expect(s.current).toBe(3);
      // Only the entry week is neutral: this full week is judged as usual.
      expect(rows.thisWeek.neutral).toBe(false);
      expect(s.freeWeekAvailable).toBe(false);
    });

    it("this week, while it's the entry week, falling short can't break the run", () => {
      const sessions = [...gdWeek("g1", "2026-09-07", 1), ...gdWeek("g1", "2026-09-14", 2), workout("ad", at("2026-09-25"), 0)];
      const enrollments = [gd("g1", at("2026-09-07"), addDays("2026-09-24", 0)), gd("ad", at("2026-09-24"))];
      const s = summarizeStreak(streakWeeksFrom({ sessions, enrollments, profileDaysPerWeek: 5, now: at("2026-09-27") }));
      expect(s).toMatchObject({ current: 2, remaining: 3, freeWeekAvailable: true });
      expect(s.thisWeek).toMatchObject({ enrollmentId: "ad", neutral: true });
    });

    it("a program switched to and undone the same week, never trained, doesn't make the week neutral", () => {
      const sessions = [...gdWeek("g1", "2026-09-14", 1), workout("g1", at("2026-09-21"), 0, 2)];
      const enrollments = [gd("g1", at("2026-09-14")), gd("x", at("2026-09-24"), addDays("2026-09-24", 0.01))];
      const rows = streakWeeksFrom({ sessions, enrollments, profileDaysPerWeek: 5, now: at("2026-09-29") });
      expect(rows.weeks[rows.weeks.length - 1]).toMatchObject({ enrollmentId: "g1", done: 1, target: 5, neutral: false });
    });

    it("a new block started Thursday–Sunday in a week the finished one already met: the week counts, judged by the finished block", () => {
      // GD Adaptação's last week done Monday–Friday; GD 1 activated on Sunday.
      const sessions = [...gdWeek("ad", "2026-09-14", 4), ...gdWeek("ad", "2026-09-21", 5)];
      const enrollments = [gd("ad", at("2026-08-24"), addDays("2026-09-25", 0)), gd("g1", at("2026-09-27"))];
      const now = addDays("2026-09-27", 0.2);
      const rows = streakWeeksFrom({ sessions, enrollments, profileDaysPerWeek: 5, now });
      expect(rows.thisWeek).toMatchObject({ enrollmentId: "ad", done: 5, met: true, neutral: true });
      expect(summarizeStreak(rows).current).toBe(2);
      // Today's rule: GD 1's entry week is complete — nothing asked before next week.
      const view = programWeekView({ startedAt: at("2026-09-27"), now, effectiveWeek: 1, entryWeekTrained: false });
      expect(thisWeekRule({ view, enrollmentId: "g1", thisWeek: rows.thisWeek })).toEqual({ targetCap: 1, alreadyCounts: true });
      // Before the finished block met it (4 of 5), the new entry week asks for its own day.
      const short = streakWeeksFrom({ sessions: sessions.slice(0, 9), enrollments, profileDaysPerWeek: 5, now });
      expect(thisWeekRule({ view, enrollmentId: "g1", thisWeek: short.thisWeek })).toEqual({ targetCap: 1, alreadyCounts: false });
    });

    it("of two programs trained in one week, the one whose week counts judges it", () => {
      // A deload week of the old block (1 workout counts) and 2 workouts of a new program started Thursday.
      const guidance = [{ week: 3, rirTarget: 4, notePt: "", setsNotePt: "Deload: metade das séries." }];
      const old: StreakEnrollment = { id: "o", startedAt: at("2026-09-07"), endedAt: addDays("2026-09-23", 0), program: program({ weeklyGuidance: guidance }) };
      const rows = streakWeeksFrom({
        sessions: [...gdWeek("o", "2026-09-07", 1), ...gdWeek("o", "2026-09-14", 2), workout("o", at("2026-09-21"), 0, 3), workout("n", at("2026-09-24"), 0), workout("n", at("2026-09-25"), 1)],
        enrollments: [old, gd("n", at("2026-09-24"))],
        profileDaysPerWeek: 5,
        now: at("2026-09-27"),
      });
      expect(rows.thisWeek).toMatchObject({ enrollmentId: "o", deload: true, trained: true });
      expect(summarizeStreak(rows).current).toBe(3);
    });

    it("a switch midweek: short of both targets, the week is the new program's entry week (Today's 1/4)", () => {
      // GD 1 Monday and Tuesday, GD Adaptação from Thursday 24 Sep with one workout on Saturday.
      const base = [...gdWeek("g1", "2026-09-07", 1), ...gdWeek("g1", "2026-09-14", 2)];
      const sessions = [...base, workout("g1", at("2026-09-21"), 0, 3), workout("g1", at("2026-09-22"), 1, 3), workout("ad", at("2026-09-26"), 0)];
      const enrollments = [gd("g1", at("2026-09-07"), addDays("2026-09-24", -0.1)), gd("ad", at("2026-09-24"))];
      const rows = streakWeeksFrom({ sessions, enrollments, profileDaysPerWeek: 5, now: at("2026-09-27") });
      expect(rows.thisWeek).toMatchObject({ enrollmentId: "ad", done: 1, target: 4, met: false, neutral: true });
      const s = summarizeStreak(rows);
      expect(s).toMatchObject({ current: 2, remaining: 3, freeWeekAvailable: true });
      // A week later the same row, as History reads it.
      const later = streakWeeksFrom({ sessions, enrollments, profileDaysPerWeek: 5, now: at("2026-09-29") });
      expect(later.weeks[later.weeks.length - 1]).toMatchObject({ enrollmentId: "ad", done: 1, target: 4, neutral: true });
      expect(summarizeStreak(later).current).toBe(2);
    });

    it("a switch midweek, the new program not trained yet: this week is its entry week; once past, the old program's", () => {
      const sessions = [...gdWeek("g1", "2026-09-14", 1), workout("g1", at("2026-09-21"), 0, 2), workout("g1", at("2026-09-22"), 1, 2)];
      const enrollments = [gd("g1", at("2026-09-14"), addDays("2026-09-24", -0.1)), gd("ad", at("2026-09-24"))];
      const now = streakWeeksFrom({ sessions, enrollments, profileDaysPerWeek: 5, now: at("2026-09-25") });
      // Today's meter: "Semana de entrada 0/4" — and 4 to go, never the old program's 3.
      expect(now.thisWeek).toMatchObject({ enrollmentId: "ad", done: 0, target: 4, neutral: true });
      expect(summarizeStreak(now)).toMatchObject({ current: 1, remaining: 4, freeWeekAvailable: true });
      // Past, the week is headed by the workouts it has (the old program's), still neutral.
      const past = streakWeeksFrom({ sessions, enrollments, profileDaysPerWeek: 5, now: at("2026-09-29") });
      expect(past.weeks[past.weeks.length - 1]).toMatchObject({ enrollmentId: "g1", done: 2, target: 5, neutral: true });
      expect(summarizeStreak(past).current).toBe(1);
    });
  });

  describe("a finished block's late workout", () => {
    const five = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"].map((name, i) => ({ id: `g${i}`, dayIndex: i, name, exerciseCount: 6 }));
    // A 3-week block whose last week is a deload (as GD's test/deload week 13).
    const guidance = [
      { week: 1, rirTarget: 3, notePt: "", setsNotePt: "" },
      { week: 2, rirTarget: 2, notePt: "", setsNotePt: "" },
      { week: 3, rirTarget: 4, notePt: "", setsNotePt: "Deload: metade das séries." },
    ];
    const block = (endedAt: Date | null): StreakEnrollment => ({
      id: "b",
      startedAt: at("2026-08-31"),
      endedAt,
      program: { daysPerWeek: 5, durationWeeks: 3, weeklyGuidance: guidance, templateSlug: null, days: five },
    });
    const w = (finishedAt: Date, day: number, programWeek: number): StreakSession => ({
      finishedAt,
      enrollmentId: "b",
      programDayId: `g${day}`,
      programDayIndex: day,
      name: five[day].name,
      programWeek,
    });
    const weeks12 = [0, 1, 2, 3, 4].flatMap((d) => [w(addDays("2026-08-31", d), d, 1), w(addDays("2026-09-07", d), d, 2)]);
    // The deload week: 2 of 5 (it counts), then one workout the week after — the block closes with it, kept in week 3.
    const sessions = [...weeks12, w(at("2026-09-14"), 0, 3), w(at("2026-09-15"), 1, 3), w(at("2026-09-22"), 2, 3)];

    it("keeps the deload in the block's last week, not in the week after that holds the late workout", () => {
      const rows = streakWeeksFrom({ sessions, enrollments: [block(at("2026-09-22"))], profileDaysPerWeek: 5, now: at("2026-09-27") });
      expect(rows.weeks[rows.weeks.length - 1]).toMatchObject({ done: 2, deload: true });
      expect(rows.thisWeek).toMatchObject({ done: 1, target: 5, deload: false, met: false });
      const s = summarizeStreak(rows);
      // 3 weeks (the deload one included); this week isn't counted by one workout.
      expect(s).toMatchObject({ current: 3, remaining: 4 });
    });

    it("a last week picked up again later (not closed by one workout) keeps its deload", () => {
      // Stopped in week 3, resumed a week later: its workout counts in week 3 again; the block is still running.
      const rows = streakWeeksFrom({ sessions, enrollments: [block(null)], profileDaysPerWeek: 5, now: at("2026-09-27") });
      expect(rows.thisWeek).toMatchObject({ done: 1, deload: true });
    });
  });
});
