import { describe, expect, it } from "vitest";
import { weeklyStreak } from "./streak";

const met = { met: true };
const miss = { met: false };

describe("weeklyStreak", () => {
  it("counts consecutive weeks that met the target", () => {
    expect(weeklyStreak([met, met, met]).current).toBe(3);
    expect(weeklyStreak([met, miss, met, met]).current).toBe(2);
  });

  it("a deload week counts when the user trained at all", () => {
    expect(weeklyStreak([met, { met: false, deload: true, trained: true }, met]).current).toBe(3);
    expect(weeklyStreak([met, { met: false, deload: true, trained: false }, met]).current).toBe(1);
  });

  it("forgives one missed week per 8 weeks of streak", () => {
    const eight = Array.from({ length: 8 }, () => met);
    const r = weeklyStreak([...eight, miss, met]);
    expect(r.current).toBe(9);
    expect(r.freeWeeksUsed).toBe(1);
    // Two misses in a row still break it.
    expect(weeklyStreak([...eight, miss, miss, met]).current).toBe(1);
    // Under 8 weeks there's no free week.
    expect(weeklyStreak([met, met, met, miss, met]).current).toBe(1);
  });

  it("the week in progress extends the streak once met and never breaks it while open", () => {
    expect(weeklyStreak([met, met], met).current).toBe(3);
    expect(weeklyStreak([met, met], miss).current).toBe(2);
  });

  it("an entry week short of its target is neutral: it neither adds a week nor breaks the run", () => {
    const shortEntry = { met: false, trained: true, neutral: true };
    expect(weeklyStreak([met, met, met, shortEntry]).current).toBe(3);
    expect(weeklyStreak([met, met, met, shortEntry, met]).current).toBe(4);
    // Untrained, too (activated on a Sunday and not trained that day).
    expect(weeklyStreak([met, met, { met: false, neutral: true }, met]).current).toBe(3);
    // Met, it counts like any week.
    expect(weeklyStreak([met, { met: true, neutral: true }, met]).current).toBe(3);
    // It doesn't use up the free week, nor hide a real miss after it.
    const eight = Array.from({ length: 8 }, () => met);
    expect(weeklyStreak([...eight, shortEntry, miss, met])).toMatchObject({ current: 9, freeWeeksUsed: 1 });
    expect(weeklyStreak([met, met, shortEntry, miss, met]).current).toBe(1);
    // This week, still open and neutral: the run stands.
    expect(weeklyStreak([met, met], shortEntry).current).toBe(2);
  });

  it("tracks the best run", () => {
    expect(weeklyStreak([met, met, met, miss, met]).best).toBe(3);
  });
});
