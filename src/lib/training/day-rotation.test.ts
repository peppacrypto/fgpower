import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  formatDayTag,
  laidOutByWeekday,
  planWeek,
  plannedWeekdays,
  restartsEachWeek,
  upcomingWorkout,
  weekStartChoice,
  weekStrip,
  whenText,
} from "./day-rotation";

const day = (i: number, exerciseCount = 5, extra: { name?: string; weekday?: number | null } = {}) => ({
  id: `d${i}`,
  dayIndex: i,
  exerciseCount,
  ...extra,
});
const base = { isTrainable: (d: { exerciseCount: number }) => d.exerciseCount > 0 };

describe("planWeek (Today's rotation)", () => {
  const days = [day(0), day(1), day(2)];

  it("the next undone day from the pointer", () => {
    const p = planWeek({ ...base, days, nextDayIndex: 1, daysPerWeek: 3, doneDayIds: new Set(["d0"]), sessionCount: 1 });
    expect(p).toMatchObject({ nextDay: { id: "d1" }, weekComplete: false, weeklyDone: 1, weeklyTarget: 3 });
  });

  it("skips days without exercises (they neither count nor get repeated)", () => {
    const p = planWeek({
      ...base,
      days: [day(0), day(1, 0), day(2)],
      nextDayIndex: 1,
      daysPerWeek: 3,
      doneDayIds: new Set(["d0"]),
      sessionCount: 1,
    });
    expect(p.nextDay?.id).toBe("d2");
    expect(p.weeklyTarget).toBe(2);
  });

  it("a plan laid out by weekday starts each week over from its first day", () => {
    // Last week ended after Segunda (pointer on Quarta); nothing done yet this week.
    const byName = ["Segunda — Superior", "Quarta — Inferior", "Sexta — Corpo inteiro"].map((name, i) => day(i, 5, { name }));
    const p = planWeek({ ...base, days: byName, nextDayIndex: 1, daysPerWeek: 3, doneDayIds: new Set(), sessionCount: 0 });
    expect(p.nextDay?.name).toBe("Segunda — Superior");
    // A planned weekday alone is the user's calendar, not the program's layout: the rotation carries on.
    const planned = [1, 3, 5].map((weekday, i) => day(i, 5, { name: `Treino ${i}`, weekday }));
    const q = planWeek({ ...base, days: planned, nextDayIndex: 1, daysPerWeek: 3, doneDayIds: new Set(), sessionCount: 0 });
    expect(q.nextDay?.id).toBe("d1");
  });

  it("any other plan carries its pointer into the new week (Sessão A/B/C at 3×: B after a Saturday A)", () => {
    const abc = ["Sessão A", "Sessão B", "Sessão C"].map((name, i) => day(i, 5, { name }));
    const p = planWeek({ ...base, days: abc, nextDayIndex: 1, daysPerWeek: 3, doneDayIds: new Set(), sessionCount: 0 });
    expect(p.nextDay?.name).toBe("Sessão B");
    // Unnamed days too.
    const q = planWeek({ ...base, days, nextDayIndex: 2, daysPerWeek: 3, doneDayIds: new Set(), sessionCount: 0 });
    expect(q.nextDay?.id).toBe("d2");
  });

  it("once the week has a workout, a weekday plan follows its pointer as well", () => {
    const byName = ["Segunda", "Quarta", "Sexta"].map((name, i) => day(i, 5, { name }));
    const p = planWeek({ ...base, days: byName, nextDayIndex: 2, daysPerWeek: 3, doneDayIds: new Set(["d0"]), sessionCount: 1 });
    expect(p.nextDay?.name).toBe("Sexta");
  });

  it("a rotating A/B plan keeps its pointer into the new week", () => {
    const ab = [day(0), day(1)];
    const p = planWeek({ ...base, days: ab, nextDayIndex: 1, daysPerWeek: 3, doneDayIds: new Set(), sessionCount: 0 });
    expect(p.nextDay?.id).toBe("d1");
  });

  it("a done week has no next day this week", () => {
    const p = planWeek({
      ...base,
      days,
      nextDayIndex: 0,
      daysPerWeek: 3,
      doneDayIds: new Set(["d0", "d1", "d2"]),
      sessionCount: 3,
    });
    expect(p).toMatchObject({ nextDay: null, weekComplete: true, weeklyDone: 3, weeklyTarget: 3 });
  });

  it("A/B at 3×/week repeats the pointer day until the frequency is met", () => {
    const ab = [day(0), day(1)];
    const p = planWeek({ ...base, days: ab, nextDayIndex: 0, daysPerWeek: 3, doneDayIds: new Set(["d0", "d1"]), sessionCount: 2 });
    expect(p).toMatchObject({ nextDay: { id: "d0" }, weekComplete: false, weeklyDone: 2, weeklyTarget: 3 });
    const done = planWeek({
      ...base,
      days: ab,
      nextDayIndex: 1,
      daysPerWeek: 3,
      doneDayIds: new Set(["d0", "d1"]),
      sessionCount: 3,
    });
    expect(done).toMatchObject({ nextDay: null, weekComplete: true, weeklyDone: 3 });
  });

  it("never suggests a day left open; the week isn't complete while one is", () => {
    const p = planWeek({
      ...base,
      days,
      nextDayIndex: 1,
      daysPerWeek: 3,
      doneDayIds: new Set(["d0"]),
      sessionCount: 1,
      skipDayIds: new Set(["d1"]),
    });
    expect(p.nextDay?.id).toBe("d2");
    const onlyOpenLeft = planWeek({
      ...base,
      days,
      nextDayIndex: 2,
      daysPerWeek: 3,
      doneDayIds: new Set(["d0", "d1"]),
      sessionCount: 3, // d0 redone
      skipDayIds: new Set(["d2"]),
    });
    expect(onlyOpenLeft).toMatchObject({ nextDay: null, weekComplete: false });
  });

  it("takes the done days as a Map too (Today's day → session map)", () => {
    const p = planWeek({ ...base, days, nextDayIndex: 1, daysPerWeek: 3, doneDayIds: new Map([["d0", "s1"]]), sessionCount: 1 });
    expect(p).toMatchObject({ nextDay: { id: "d1" }, weeklyDone: 1 });
  });
});

describe("which plans start each week over", () => {
  it("a day named after a weekday lays the plan out by weekday; a planned weekday alone doesn't", () => {
    expect(laidOutByWeekday([day(0, 5, { name: "Segunda — Superior (pesado)" }), day(1, 5, { name: "Treino extra" })])).toBe(true);
    expect(laidOutByWeekday([day(0, 5, { name: "Treino A", weekday: 2 })])).toBe(false);
    expect(laidOutByWeekday([day(0, 5, { name: "Sessão A" }), day(1, 5, { name: "Treino de sexta" })])).toBe(false);
    expect(laidOutByWeekday([day(0), day(1)])).toBe(false);
  });

  it("only when it doesn't repeat days: a weekday A/B at 3×/week still rotates", () => {
    const twoNamed = [day(0, 5, { name: "Segunda" }), day(1, 5, { name: "Quinta" })];
    expect(restartsEachWeek(twoNamed, 2)).toBe(true);
    expect(restartsEachWeek(twoNamed, 3)).toBe(false);
  });
});

// The summary's "Próximo treino" promises what Today offers on a later date,
// through planWeek. That promise holds only while Today's page reads its
// rotation from planWeek too, instead of an inline copy of the rule.
describe("Today's page uses this rule", () => {
  const todayPage = readFileSync(path.resolve(import.meta.dirname, "../../app/app/today/page.tsx"), "utf8");
  const why = "src/app/app/today/page.tsx must read its rotation from planWeek (lib/training/day-rotation)";

  it("imports the rotation (upcomingWorkout wraps planWeek) and calls it", () => {
    expect(
      /import \{[^}]*\b(?:planWeek|upcomingWorkout)\b[^}]*\} from "@\/lib\/training\/day-rotation"/.test(todayPage),
      why,
    ).toBe(true);
    expect(/\b(?:planWeek|upcomingWorkout)\(/.test(todayPage), why).toBe(true);
  });

  it("keeps no inline copy of the pointer rule", () => {
    expect(/const repeatsDays\s*=|\.dayIndex === enrollment\?\.nextDayIndex/.test(todayPage), why).toBe(false);
  });
});

describe("entry week and a continued sequence", () => {
  const gd = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"].map((name, i) => day(i, 5, { name }));

  it("an entry week aims at the days left: target capped, complete once they're done", () => {
    const p = planWeek({ ...base, days: gd, nextDayIndex: 0, daysPerWeek: 5, doneDayIds: new Set(), sessionCount: 0, targetCap: 2 });
    expect(p).toMatchObject({ nextDay: { name: "Segunda" }, weeklyDone: 0, weeklyTarget: 2, weekComplete: false });
    const done = planWeek({
      ...base,
      days: gd,
      nextDayIndex: 2,
      daysPerWeek: 5,
      doneDayIds: new Set(["d0", "d1"]),
      sessionCount: 2,
      targetCap: 2,
    });
    expect(done).toMatchObject({ nextDay: null, weeklyDone: 2, weeklyTarget: 2, weekComplete: true });
    // A cap above the plan changes nothing.
    expect(planWeek({ ...base, days: gd, nextDayIndex: 0, daysPerWeek: 5, doneDayIds: new Set(), sessionCount: 0, targetCap: 7 }).weeklyTarget).toBe(5);
  });

  it("'Continuar a sequência' starts the week at the pointer instead of Segunda", () => {
    const p = planWeek({ ...base, days: gd, nextDayIndex: 3, daysPerWeek: 5, doneDayIds: new Set(), sessionCount: 0, carryOver: true });
    expect(p.nextDay?.name).toBe("Quinta");
  });

  it("offers the days left over from last week, continuing by default for a user below the plan's frequency", () => {
    const lastWeek = { doneDayIds: new Set(["d0", "d1", "d2"]), sessionCount: 3, entry: false };
    const choice = weekStartChoice({ ...base, days: gd, nextDayIndex: 3, daysPerWeek: 5, sessionCount: 0, lastWeek });
    expect(choice?.leftover.map((d) => d.name)).toEqual(["Quinta", "Sexta"]);
    expect(choice?.byDefault).toBe("continue");
    // Usually all five: last week was a one-off, start over on Segunda.
    const usual = weekStartChoice({
      ...base,
      days: gd,
      nextDayIndex: 3,
      daysPerWeek: 5,
      sessionCount: 0,
      lastWeek,
      recentWeeklyDays: [3, 5, 5, 5],
    });
    expect(usual?.byDefault).toBe("restart");
  });

  it("no choice once the week has a workout, after a full week or a week off, or for a rotation", () => {
    const lastWeek = { doneDayIds: new Set(["d0", "d1", "d2"]), sessionCount: 3, entry: false };
    const args = { ...base, days: gd, nextDayIndex: 3, daysPerWeek: 5, sessionCount: 0, lastWeek };
    expect(weekStartChoice({ ...args, sessionCount: 1 })).toBeNull();
    expect(weekStartChoice({ ...args, nextDayIndex: 0 })).toBeNull();
    expect(weekStartChoice({ ...args, lastWeek: { doneDayIds: new Set(), sessionCount: 0, entry: false } })).toBeNull();
    const abc = ["Sessão A", "Sessão B", "Sessão C"].map((name, i) => day(i, 5, { name }));
    expect(weekStartChoice({ ...args, days: abc, nextDayIndex: 2, daysPerWeek: 3 })).toBeNull();
  });

  // Monday 28 Sep 2026 as a day number.
  const MON = Math.floor(Date.UTC(2026, 8, 28) / 86_400_000);

  it("never the same heavy day twice in a row: Segunda on Sunday → Terça on Monday", () => {
    // A Sunday catch-up of Segunda after a week that stalled — even for a user who usually does all five.
    const sunday = {
      doneDayIds: new Set(["d0"]),
      sessionCount: 1,
      entry: false,
      lastDayId: "d0",
      lastDoneNo: MON - 1,
    };
    const choice = weekStartChoice({
      ...base,
      days: gd,
      nextDayIndex: 1,
      daysPerWeek: 5,
      sessionCount: 0,
      lastWeek: sunday,
      mondayNo: MON,
      recentWeeklyDays: [5, 5, 5, 5],
    });
    expect(choice).toMatchObject({ byDefault: "continue", afterEntryWeek: false });
    const monday = planWeek({ ...base, days: gd, nextDayIndex: 1, daysPerWeek: 5, doneDayIds: new Set(), sessionCount: 0, carryOver: true });
    expect(monday.nextDay?.name).toBe("Terça");
    // Any day done the day before the new week continues too (Quinta on Sunday → Sexta on Monday).
    const quinta = { doneDayIds: new Set(["d0", "d1", "d2", "d3"]), sessionCount: 4, entry: false, lastDayId: "d3", lastDoneNo: MON - 1 };
    expect(
      weekStartChoice({ ...base, days: gd, nextDayIndex: 4, daysPerWeek: 5, sessionCount: 0, lastWeek: quinta, mondayNo: MON, recentWeeklyDays: [5, 5] })
        ?.byDefault,
    ).toBe("continue");
  });

  it("after an entry week with a workout: a choice, continuing when its last day was the first or the day before", () => {
    // Activated Sunday, trained Segunda that day.
    const sundayEntry = { doneDayIds: new Set(["d0"]), sessionCount: 1, entry: true, lastDayId: "d0", lastDoneNo: MON - 1 };
    const args = { ...base, days: gd, nextDayIndex: 1, daysPerWeek: 5, sessionCount: 0, mondayNo: MON };
    expect(weekStartChoice({ ...args, lastWeek: sundayEntry })).toMatchObject({
      byDefault: "continue",
      afterEntryWeek: true,
      leftover: [{ name: "Terça" }, { name: "Quarta" }, { name: "Quinta" }, { name: "Sexta" }],
    });
    // Activated Thursday, Segunda and Terça done Thursday and Friday: Monday's day on Monday.
    const thursdayEntry = { doneDayIds: new Set(["d0", "d1"]), sessionCount: 2, entry: true, lastDayId: "d1", lastDoneNo: MON - 3 };
    expect(weekStartChoice({ ...args, nextDayIndex: 2, lastWeek: thursdayEntry })?.byDefault).toBe("restart");
    // Without the dates (an older caller): the entry week still starts over.
    expect(weekStartChoice({ ...args, nextDayIndex: 2, mondayNo: undefined, lastWeek: { ...thursdayEntry, lastDayId: undefined, lastDoneNo: undefined } })?.byDefault).toBe(
      "restart",
    );
  });

  it("a date promised into next week follows the same default (the summary's and Today's)", () => {
    // Sunday of an entry week: Segunda done today; next week starts at Terça, on Monday.
    const SUN = MON - 1;
    const up = upcomingWorkout({
      ...base,
      days: gd,
      daysPerWeek: 5,
      preferredDays: [],
      nextDayIndex: 1,
      doneDayIds: new Set(["d0"]),
      sessionCount: 1,
      todayNo: SUN,
      lastDoneNo: SUN,
      targetCap: 1,
      carryOverNextWeek: true,
    });
    expect(up.next).toMatchObject({ day: { name: "Terça" }, dayNo: MON, nextWeek: true });
  });
});

describe("the next workout's date (Today's hero and rest day)", () => {
  // Monday 28 Sep 2026 as a day number; MON + 4 is Friday.
  const MON = Math.floor(Date.UTC(2026, 8, 28) / 86_400_000);
  const abc = ["Sessão A", "Sessão B", "Sessão C"].map((name, i) => day(i, 5, { name, weekday: [1, 3, 5][i] }));
  const args = { ...base, days: abc, daysPerWeek: 3, preferredDays: [] as number[] };

  it("a planned day is today; a workout done today makes it a rest day until the next planned one", () => {
    const monday = upcomingWorkout({ ...args, nextDayIndex: 0, doneDayIds: new Set(), sessionCount: 0, todayNo: MON, lastDoneNo: null });
    expect(monday).toMatchObject({ restToday: false, next: { day: { name: "Sessão A" }, dayNo: MON, isToday: true } });
    const after = upcomingWorkout({
      ...args,
      nextDayIndex: 1,
      doneDayIds: new Set(["d0"]),
      sessionCount: 1,
      todayNo: MON,
      lastDoneNo: MON,
    });
    expect(after).toMatchObject({ restToday: true, next: { day: { name: "Sessão B" }, dayNo: MON + 2, nextWeek: false } });
    expect(whenText(after.next!.dayNo, MON)).toBe("na quarta");
  });

  it("an unplanned day with the week on track is a rest day; falling behind makes today the day", () => {
    const tuesday = upcomingWorkout({
      ...args,
      nextDayIndex: 1,
      doneDayIds: new Set(["d0"]),
      sessionCount: 1,
      todayNo: MON + 1,
      lastDoneNo: MON,
    });
    expect(tuesday).toMatchObject({ restToday: true, next: { dayNo: MON + 2 } });
    // Thursday with nothing done: 3 to do, one planned day (Friday) left — catch up today.
    const thursday = upcomingWorkout({ ...args, nextDayIndex: 0, doneDayIds: new Set(), sessionCount: 0, todayNo: MON + 3, lastDoneNo: null });
    expect(thursday).toMatchObject({ restToday: false, next: { isToday: true, day: { name: "Sessão A" } } });
  });

  it("a Friday finisher who still owes a workout is sent to next week's first planned day, with the rotation carried", () => {
    const friday = upcomingWorkout({
      ...args,
      nextDayIndex: 2,
      doneDayIds: new Set(["d0", "d1"]),
      sessionCount: 2,
      todayNo: MON + 4,
      lastDoneNo: MON + 4,
    });
    expect(friday).toMatchObject({ restToday: true, next: { day: { name: "Sessão C" }, dayNo: MON + 7, nextWeek: true } });
    expect(formatDayTag(friday.next!.dayNo)).toBe("SEG · 05 OUT");
  });

  it("a complete week points at next week; a weekday plan starts it over unless it carries on", () => {
    const gd = ["Segunda", "Terça", "Quarta"].map((name, i) => day(i, 5, { name }));
    const done = { ...base, days: gd, daysPerWeek: 3, preferredDays: [] };
    const full = upcomingWorkout({
      ...done,
      nextDayIndex: 0,
      doneDayIds: new Set(["d0", "d1", "d2"]),
      sessionCount: 3,
      todayNo: MON + 2,
      lastDoneNo: MON + 2,
    });
    expect(full).toMatchObject({ week: { weekComplete: true }, restToday: true, next: { day: { name: "Segunda" }, dayNo: MON + 7 } });
    const short = upcomingWorkout({
      ...done,
      nextDayIndex: 2,
      doneDayIds: new Set(["d0", "d1"]),
      sessionCount: 2,
      todayNo: MON + 6,
      lastDoneNo: MON + 6,
      carryOverNextWeek: true,
    });
    expect(short.next).toMatchObject({ day: { name: "Quarta" }, nextWeek: true });
  });

  it("an entry week suggests today, then tomorrow — every day left counts", () => {
    const gd = ["Segunda", "Terça", "Quarta"].map((name, i) => day(i, 5, { name, weekday: [1, 3, 5][i] }));
    const saturday = upcomingWorkout({
      ...base,
      days: gd,
      daysPerWeek: 3,
      preferredDays: [],
      nextDayIndex: 1,
      doneDayIds: new Set(["d0"]),
      sessionCount: 1,
      todayNo: MON + 5,
      lastDoneNo: MON + 4,
      targetCap: 2,
    });
    expect(saturday).toMatchObject({ restToday: false, week: { weeklyTarget: 2 }, next: { day: { name: "Terça" }, isToday: true } });
  });

  it("without a schedule: today, or spaced by the frequency after a workout today", () => {
    const plain = [day(0), day(1), day(2)];
    const p = { ...base, days: plain, daysPerWeek: 3, preferredDays: [] as number[] };
    expect(upcomingWorkout({ ...p, nextDayIndex: 0, doneDayIds: new Set(), sessionCount: 0, todayNo: MON + 1, lastDoneNo: MON }).next).toMatchObject({
      isToday: true,
    });
    const done = upcomingWorkout({ ...p, nextDayIndex: 1, doneDayIds: new Set(["d0"]), sessionCount: 1, todayNo: MON, lastDoneNo: MON });
    expect(done).toMatchObject({ restToday: true, next: { dayNo: MON + 2 } });
    // A Sunday finisher at 3×/week goes to Tuesday.
    const sunday = upcomingWorkout({
      ...p,
      nextDayIndex: 2,
      doneDayIds: new Set(["d0", "d1"]),
      sessionCount: 2,
      todayNo: MON + 6,
      lastDoneNo: MON + 6,
    });
    expect(sunday.next).toMatchObject({ dayNo: MON + 8, nextWeek: true });
  });

  it("the week strip marks planned days, days trained and today", () => {
    const cells = weekStrip({ todayNo: MON + 2, planned: plannedWeekdays(abc), doneDayNos: [MON] });
    expect(cells.map((c) => c.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(cells.filter((c) => c.planned).map((c) => c.weekday)).toEqual([1, 3, 5]);
    expect(cells[0]).toMatchObject({ done: true, past: true });
    expect(cells[2]).toMatchObject({ today: true, done: false });
    // A program started on Wednesday plans nothing before it.
    const fromWed = weekStrip({ todayNo: MON + 2, planned: plannedWeekdays(abc), doneDayNos: [], fromNo: MON + 2 });
    expect(fromWed.filter((c) => c.planned).map((c) => c.weekday)).toEqual([3, 5]);
    // Preferred days stand in for unplanned days; then names.
    expect([...plannedWeekdays([day(0)], [2, 4])]).toEqual([2, 4]);
    expect([...plannedWeekdays([day(0, 5, { name: "Sexta — Pernas" })])]).toEqual([5]);
  });

  it("the day the hero suggests is a training day on the strip (an entry week, a catch-up)", () => {
    // GD-like Monday–Friday plan activated on Sunday: Sunday is no planned weekday, but today is the day.
    const SUN = MON + 6;
    const monFri = new Set([1, 2, 3, 4, 5]);
    const cells = weekStrip({ todayNo: SUN, planned: monFri, doneDayNos: [], fromNo: SUN, suggestedNo: SUN });
    expect(cells.find((c) => c.today)).toMatchObject({ planned: true, done: false });
    expect(cells.filter((c) => c.planned)).toHaveLength(1);
  });
});
