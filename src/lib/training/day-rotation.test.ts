import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { laidOutByWeekday, planWeek, restartsEachWeek } from "./day-rotation";

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
    // A planned weekday lays it out too, whatever the names.
    const planned = [1, 3, 5].map((weekday, i) => day(i, 5, { name: `Treino ${i}`, weekday }));
    const q = planWeek({ ...base, days: planned, nextDayIndex: 1, daysPerWeek: 3, doneDayIds: new Set(), sessionCount: 0 });
    expect(q.nextDay?.id).toBe("d0");
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
  it("a day named after a weekday, or with a planned one, lays the plan out by weekday", () => {
    expect(laidOutByWeekday([day(0, 5, { name: "Segunda — Superior (pesado)" }), day(1, 5, { name: "Treino extra" })])).toBe(true);
    expect(laidOutByWeekday([day(0, 5, { name: "Treino A", weekday: 2 })])).toBe(true);
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

  it("imports planWeek and calls it", () => {
    expect(/import \{[^}]*\bplanWeek\b[^}]*\} from "@\/lib\/training\/day-rotation"/.test(todayPage), why).toBe(true);
    expect(/\bplanWeek\(/.test(todayPage), why).toBe(true);
  });

  it("keeps no inline copy of the pointer rule", () => {
    expect(/const repeatsDays\s*=|\.dayIndex === enrollment\?\.nextDayIndex/.test(todayPage), why).toBe(false);
  });
});
