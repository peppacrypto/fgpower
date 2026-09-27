import { describe, expect, it } from "vitest";
import { planWeek } from "@/lib/training/day-rotation";
import { adviceFromLastTime } from "@/lib/training/set-plan";
import {
  compareWithLast,
  formatDayNumber,
  formatSpShortDate,
  nextWorkout,
  setsText,
  spDayNumber,
  suggestNextDate,
  weekStreak,
  weekdayFromName,
  weekdayOf,
  type PlanDay,
} from "./dossier";

const s = (weightKg: number, ...reps: number[]) => reps.map((r) => ({ weightKg, reps: r }));
const nb = (t: string) => t.replace(/ /g, " ");

describe("compareWithLast", () => {
  it("no previous time is a first time", () => {
    expect(compareWithLast(s(60, 10), null)).toEqual({ kind: "first" });
    expect(compareWithLast(s(60, 10), [])).toEqual({ kind: "first" });
  });

  it("a heavier or lighter top load is a load change", () => {
    expect(compareWithLast(s(62.5, 8, 8), s(60, 10, 10))).toEqual({ kind: "load", direction: "up", deltaKg: 2.5 });
    expect(compareWithLast(s(55, 10), s(60, 10))).toEqual({ kind: "load", direction: "down", deltaKg: 5 });
  });

  it("at the same top load, the reps done with it: 3×12 after 3×10 is +6", () => {
    expect(compareWithLast(s(60, 12, 12, 12), s(60, 10, 10, 10))).toEqual({
      kind: "reps",
      direction: "up",
      deltaReps: 6,
      sets: null,
    });
    expect(compareWithLast(s(60, 10, 9), s(60, 10, 10))).toEqual({ kind: "reps", direction: "down", deltaReps: 1, sets: null });
    expect(compareWithLast(s(60, 10, 10), s(60, 10, 10))).toEqual({ kind: "same" });
  });

  it("fewer sets at the load is said as such, never as lost reps: 30×12 after 30×10,10", () => {
    const d = compareWithLast(s(30, 12), s(30, 10, 10));
    expect(d).toEqual({ kind: "reps", direction: "up", deltaReps: 2, sets: { now: 1, before: 2 } });
    expect(compareWithLast(s(60, 12), s(60, 12, 10, 8))).toEqual({
      kind: "sets",
      direction: "down",
      sets: { now: 1, before: 3 },
    });
  });

  it("an extra set at the load is a gain", () => {
    expect(compareWithLast(s(60, 10, 10, 10), s(60, 10, 10))).toEqual({
      kind: "sets",
      direction: "up",
      sets: { now: 3, before: 2 },
    });
  });

  it("extras don't count when prescribed sets exist", () => {
    const now = [...s(60, 10, 10), { weightKg: 40, reps: 20, isExtra: true }];
    expect(compareWithLast(now, s(60, 10, 10))).toEqual({ kind: "same" });
  });

  it("bodyweight compares reps", () => {
    expect(compareWithLast(s(0, 12, 10), s(0, 10, 10))).toEqual({ kind: "reps", direction: "up", deltaReps: 2, sets: null });
  });
});

describe("Na próxima (the workout screen's rule on this session's sets)", () => {
  const prescribed = { repMin: 8, repMax: 12, rirTarget: 2.5 };
  const advise = (sets: [number, number][], prescribedSets: number) =>
    adviceFromLastTime({
      strategy: "DOUBLE",
      prescribed,
      lastTime: { sets: sets.map(([weightKg, reps]) => ({ weightKg, reps, rir: 2.5, isExtra: false })), prescribedSets },
      loadIncrementKg: 2.5,
    });

  it("1 of 2 prescribed sets at the top of the range holds the load", () => {
    expect(advise([[30, 12]], 2)).toMatchObject({ kind: "hold", loadKg: 30 });
  });

  it("every prescribed set at the top of the range raises it", () => {
    expect(advise([[30, 12], [30, 12]], 2)).toMatchObject({ kind: "increase", loadKg: 32.5 });
  });
});

describe("setsText", () => {
  it("groups consecutive sets at one load", () => {
    expect(nb(setsText([...s(60, 12, 12), ...s(62.5, 8)]))).toBe("60 kg × 12, 12 · 62,5 kg × 8");
  });
});

const day = (i: number, exerciseCount = 5): PlanDay => ({
  id: `d${i}`,
  dayIndex: i,
  name: `Dia ${i}`,
  exerciseCount,
  weekday: null,
  estimatedMinutes: null,
});

describe("nextWorkout: the summary promises what Today will offer on that date", () => {
  // São Paulo 18:00 (21:00 UTC). Week of Mon 21 – Sun 27 Sep 2026; next week starts Mon 28.
  const at = (isoDay: string) => new Date(`${isoDay}T21:00:00Z`);
  const named = (i: number, name: string): PlanDay => ({ ...day(i), name });
  const weekdayPlan = [named(0, "Segunda — Superior"), named(1, "Quarta — Inferior"), named(2, "Sexta — Corpo inteiro")];
  const abc = [named(0, "Sessão A"), named(1, "Sessão B"), named(2, "Sessão C")];
  const ab = [named(0, "Sessão A"), named(1, "Sessão B")];

  function predict(p: {
    days: PlanDay[];
    finished: string;
    done: string[];
    sessionCount?: number;
    nextDayIndex: number;
    daysPerWeek?: number;
    preferredDays?: number[];
    open?: string[];
  }) {
    const input = {
      days: p.days,
      nextDayIndex: p.nextDayIndex,
      daysPerWeek: p.daysPerWeek ?? 3,
      doneDayIds: new Set(p.done),
      sessionCount: p.sessionCount ?? p.done.length,
      openDayIds: new Set(p.open ?? []),
      finishedAt: at(p.finished),
      now: at(p.finished),
      preferredDays: p.preferredDays ?? [],
    };
    const next = nextWorkout(input);
    // Today on that date, if nothing else is trained before it: the same week's
    // state, or a new week with nothing done yet (open days are left open by
    // then). Today reads the same planWeek — day-rotation.test.ts checks that
    // its page does — so this guards the date/week bookkeeping; the expected
    // texts in each case pin the rule itself.
    const sameWeek = Math.floor((next.date!.dayNo + 3) / 7) === Math.floor((spDayNumber(input.now) + 3) / 7);
    const todayOn = (state: { doneDayIds: Set<string>; sessionCount: number }) =>
      planWeek({
        days: p.days,
        isTrainable: (d) => d.exerciseCount > 0,
        nextDayIndex: p.nextDayIndex,
        daysPerWeek: input.daysPerWeek,
        skipDayIds: input.openDayIds,
        ...state,
      }).nextDay?.name;
    expect(todayOn(sameWeek ? input : { doneDayIds: new Set(), sessionCount: 0 })).toBe(next.day?.name);
    return {
      ...next,
      text: `${next.day?.name} · ${formatDayNumber(next.date!.dayNo)}`,
      /** What Today shows right away, back from the summary. */
      todayNow: todayOn(input) ?? null,
    };
  }

  describe("a plan named by weekday (restarts each week)", () => {
    it("on track, the next day this week", () => {
      expect(predict({ days: weekdayPlan, finished: "2026-09-23", done: ["d0", "d1"], nextDayIndex: 2 }).text).toBe(
        "Sexta — Corpo inteiro · sex 25 set",
      );
    });

    it("Friday finisher of Segunda: Quarta would be next week, where Today starts over at Segunda", () => {
      const next = predict({ days: weekdayPlan, finished: "2026-09-25", done: ["d0"], nextDayIndex: 1 });
      expect(next.text).toBe("Segunda — Superior · seg 28 set");
      expect(next).toMatchObject({ weekComplete: false, weeklyDone: 1, weeklyTarget: 3 });
    });

    it("Saturday finisher of Quarta: Segunda on Monday, not Sexta (which Today still offers this weekend)", () => {
      const next = predict({ days: weekdayPlan, finished: "2026-09-26", done: ["d0", "d1"], nextDayIndex: 2 });
      expect(next.text).toBe("Segunda — Superior · seg 28 set");
      expect(next.todayNow).toBe("Sexta — Corpo inteiro");
    });

    it("Sunday finisher of the whole week: Segunda on Monday", () => {
      const next = predict({ days: weekdayPlan, finished: "2026-09-27", done: ["d0", "d1", "d2"], nextDayIndex: 0 });
      expect(next.text).toBe("Segunda — Superior · seg 28 set");
      expect(next).toMatchObject({ weekComplete: true, weeklyDone: 3 });
    });

    it("planned weekdays lay it out the same, whatever the names: a Friday finisher of Treino 1 gets Treino 1 on Monday", () => {
      const planned = [1, 3, 5].map((weekday, i) => ({ ...named(i, `Treino ${i + 1}`), weekday }));
      const next = predict({ days: planned, finished: "2026-09-25", done: ["d0"], nextDayIndex: 1 });
      expect(next.text).toBe("Treino 1 · seg 28 set");
    });
  });

  describe("a plan that doesn't repeat days, not laid out by weekday (Sessão A/B/C at 3×: keeps its pointer)", () => {
    it("Friday finisher of A: B on Sunday, still this week", () => {
      expect(predict({ days: abc, finished: "2026-09-25", done: ["d0"], nextDayIndex: 1 }).text).toBe("Sessão B · dom 27 set");
    });

    it("Saturday finisher of A: B on Monday — the day Today offers right away too, never A twice in a row", () => {
      const next = predict({ days: abc, finished: "2026-09-26", done: ["d0"], nextDayIndex: 1 });
      expect(next.text).toBe("Sessão B · seg 28 set");
      expect(next.todayNow).toBe("Sessão B");
      expect(next).toMatchObject({ weekComplete: false, weeklyDone: 1, weeklyTarget: 3 });
    });

    it("Sunday finisher of A: B after a rest day", () => {
      expect(predict({ days: abc, finished: "2026-09-27", done: ["d0"], nextDayIndex: 1 }).text).toBe("Sessão B · ter 29 set");
    });

    it("preferred days move the date, never the rule", () => {
      expect(
        predict({ days: abc, finished: "2026-09-26", done: ["d0"], nextDayIndex: 1, preferredDays: [1, 3, 5] }).text,
      ).toBe("Sessão B · seg 28 set");
    });

    it("a day left open is skipped, as Today skips it — this week and next", () => {
      expect(predict({ days: abc, finished: "2026-09-25", done: ["d0"], nextDayIndex: 1, open: ["d1"] }).text).toBe(
        "Sessão C · dom 27 set",
      );
      expect(predict({ days: abc, finished: "2026-09-26", done: ["d0"], nextDayIndex: 1, open: ["d1"] }).text).toBe(
        "Sessão C · seg 28 set",
      );
    });

    it("a done week: the pointer day after a rest day", () => {
      const next = predict({ days: abc, finished: "2026-09-27", done: ["d0", "d1", "d2"], nextDayIndex: 0 });
      expect(next.text).toBe("Sessão A · ter 29 set");
      expect(next.weekComplete).toBe(true);
    });
  });

  describe("a rotating A/B plan (2 days at 3×: keeps its pointer across weeks)", () => {
    it("Friday finisher of A: B on Sunday", () => {
      expect(predict({ days: ab, finished: "2026-09-25", done: ["d0"], nextDayIndex: 1 }).text).toBe("Sessão B · dom 27 set");
    });

    it("Saturday finisher of A: B on Monday", () => {
      const next = predict({ days: ab, finished: "2026-09-26", done: ["d0"], nextDayIndex: 1 });
      expect(next.text).toBe("Sessão B · seg 28 set");
      expect(next).toMatchObject({ weekComplete: false, weeklyDone: 1, weeklyTarget: 3 });
    });

    it("Sunday finisher of B (A done Friday): the repeat of A moves to next week, after a rest day", () => {
      expect(predict({ days: ab, finished: "2026-09-27", done: ["d0", "d1"], nextDayIndex: 0 }).text).toBe(
        "Sessão A · ter 29 set",
      );
    });

    it("a done week: the pointer day next Monday", () => {
      const next = predict({ days: ab, finished: "2026-09-25", done: ["d0", "d1"], sessionCount: 3, nextDayIndex: 1 });
      expect(next.text).toBe("Sessão B · seg 28 set");
      expect(next.weekComplete).toBe(true);
    });
  });

  it("no trainable day: nothing to suggest", () => {
    const next = nextWorkout({
      days: [day(0, 0)],
      nextDayIndex: 0,
      daysPerWeek: 3,
      doneDayIds: new Set(),
      sessionCount: 0,
      openDayIds: new Set(),
      finishedAt: at("2026-09-25"),
      now: at("2026-09-25"),
      preferredDays: [],
    });
    expect(next).toMatchObject({ day: null, date: null, weekComplete: false, openDaysBlocking: 0 });
  });

  it("every day with exercises left open: nothing to promise, and it says why", () => {
    // A 1-day plan: an old copy of the day is still open; the day was redone and finished today.
    const next = nextWorkout({
      days: [named(0, "Corpo inteiro"), day(1, 0)],
      nextDayIndex: 1,
      daysPerWeek: 3,
      doneDayIds: new Set(["d0"]),
      sessionCount: 1,
      openDayIds: new Set(["d0"]),
      finishedAt: at("2026-09-25"),
      now: at("2026-09-25"),
      preferredDays: [],
    });
    expect(next).toMatchObject({ day: null, date: null, weekComplete: false, openDaysBlocking: 1 });
    // A/B with both days left open (A redone and finished since): two to save or discard.
    const both = predictNone({ days: ab, done: ["d0"], open: ["d0", "d1"] });
    expect(both).toMatchObject({ day: null, openDaysBlocking: 2 });
    // One of two open: the other day is still promised.
    expect(predictNone({ days: ab, done: ["d0"], open: ["d0"] })).toMatchObject({ day: { name: "Sessão B" }, openDaysBlocking: 0 });
  });

  function predictNone(p: { days: PlanDay[]; done: string[]; open: string[] }) {
    return nextWorkout({
      days: p.days,
      nextDayIndex: 1,
      daysPerWeek: 3,
      doneDayIds: new Set(p.done),
      sessionCount: p.done.length,
      openDayIds: new Set(p.open),
      finishedAt: at("2026-09-25"),
      now: at("2026-09-25"),
      preferredDays: [],
    });
  }
});

describe("São Paulo days", () => {
  // Friday 2026-09-25 23:30 in São Paulo = Saturday 02:30 UTC.
  const fridayNight = new Date("2026-09-26T02:30:00Z");

  it("dates by the São Paulo wall clock", () => {
    expect(formatSpShortDate(fridayNight)).toBe("sex 25 set");
    expect(weekdayOf(spDayNumber(fridayNight))).toBe(5);
    expect(formatDayNumber(spDayNumber(fridayNight) + 3)).toBe("seg 28 set");
  });

  it("suggests the rest gap of the weekly frequency, never before tomorrow", () => {
    const base = { finishedAt: fridayNight, now: fridayNight, plannedWeekday: null, preferredDays: [], nextWeek: false };
    const three = suggestNextDate({ ...base, daysPerWeek: 3 });
    expect(formatDayNumber(three.dayNo)).toBe("dom 27 set");
    const five = suggestNextDate({ ...base, daysPerWeek: 5 });
    expect(formatDayNumber(five.dayNo)).toBe("sáb 26 set");
    expect(five.isTomorrow).toBe(true);
  });

  it("uses the planned weekday, else the preferred days", () => {
    const base = { finishedAt: fridayNight, now: fridayNight, daysPerWeek: 3, nextWeek: false };
    expect(formatDayNumber(suggestNextDate({ ...base, plannedWeekday: 3, preferredDays: [1] }).dayNo)).toBe("qua 30 set");
    expect(formatDayNumber(suggestNextDate({ ...base, plannedWeekday: null, preferredDays: [1, 3, 5] }).dayNo)).toBe(
      "seg 28 set",
    );
  });

  it("a day named after a weekday goes on that weekday, unless the user has preferred days", () => {
    const base = { finishedAt: fridayNight, now: fridayNight, daysPerWeek: 5, nextWeek: false, plannedWeekday: null };
    const named = weekdayFromName("Sexta — Pernas (posterior de coxa e glúteos)");
    expect(named).toBe(5);
    expect(formatDayNumber(suggestNextDate({ ...base, preferredDays: [], namedWeekday: named }).dayNo)).toBe("sex 02 out");
    expect(formatDayNumber(suggestNextDate({ ...base, preferredDays: [1], namedWeekday: named }).dayNo)).toBe("seg 28 set");
    expect(formatDayNumber(suggestNextDate({ ...base, plannedWeekday: 3, preferredDays: [], namedWeekday: named }).dayNo)).toBe(
      "qua 30 set",
    );
  });

  it("a day of next week waits for next Monday — and for the rest gap", () => {
    const sunday = new Date("2026-09-27T21:00:00Z");
    const next = suggestNextDate({
      finishedAt: sunday,
      now: sunday,
      plannedWeekday: null,
      preferredDays: [],
      daysPerWeek: 3,
      nextWeek: true,
    });
    expect(formatDayNumber(next.dayNo)).toBe("ter 29 set");
  });

  it("a done week waits for next Monday", () => {
    const wednesday = new Date("2026-09-23T15:00:00Z");
    const next = suggestNextDate({
      finishedAt: wednesday,
      now: wednesday,
      plannedWeekday: null,
      preferredDays: [],
      daysPerWeek: 3,
      nextWeek: true,
    });
    expect(formatDayNumber(next.dayNo)).toBe("seg 28 set");
  });

  it("opened days later, the suggestion is never in the past", () => {
    const monday = new Date("2026-09-21T15:00:00Z");
    const thursday = new Date("2026-09-24T15:00:00Z");
    const next = suggestNextDate({
      finishedAt: monday,
      now: thursday,
      plannedWeekday: null,
      preferredDays: [],
      daysPerWeek: 3,
      nextWeek: false,
    });
    expect(next).toMatchObject({ isToday: true });
  });
});

describe("weekdayFromName", () => {
  it("reads a leading weekday, accents and case aside", () => {
    expect(weekdayFromName("Segunda — Superior A")).toBe(1);
    expect(weekdayFromName("terça - Inferior")).toBe(2);
    expect(weekdayFromName("SÁBADO")).toBe(6);
    expect(weekdayFromName("Domingo: descanso ativo")).toBe(0);
  });

  it("anything else has none", () => {
    expect(weekdayFromName("Corpo Inteiro A")).toBeNull();
    expect(weekdayFromName("Treino de sexta")).toBeNull();
    expect(weekdayFromName("Segundão")).toBeNull();
  });
});

describe("weekStreak", () => {
  const today = spDayNumber(new Date("2026-09-26T15:00:00Z")); // Saturday
  const monday = today - 5;

  it("counts weeks in a row with a workout, up to this week", () => {
    expect(weekStreak([today, monday - 3, monday - 10], today)).toBe(3);
    expect(weekStreak([today, monday - 10], today)).toBe(1); // last week had none
    expect(weekStreak([], today)).toBe(0);
  });

  it("an empty current week doesn't break the streak yet", () => {
    expect(weekStreak([monday - 1, monday - 8], today)).toBe(2);
    expect(weekStreak([monday - 8], today)).toBe(0);
  });
});
