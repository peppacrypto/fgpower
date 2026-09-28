import { describe, expect, it } from "vitest";
import {
  bestSetText,
  byGain,
  compareSessions,
  consistencyOf,
  describePr,
  periodStartDate,
  progressMode,
  summarizeConsistency,
  type LedgerWeek,
  type WeekRow,
  type SessionPerf,
} from "./progress-core";
import { dayNumberOf, mondayOf } from "@/lib/training/day-rotation";

const NBSP = " ";
const MINUS = "−";

function perf(p: Partial<SessionPerf>): SessionPerf {
  const topKg = p.topKg ?? 60;
  const topReps = p.topReps ?? 8;
  const reliable = topKg > 0 && topReps <= 10;
  const e1 = reliable ? Math.round(topKg * (topReps === 1 ? 1 : 1 + topReps / 30) * 10) / 10 : null;
  return {
    sessionId: "s",
    date: new Date("2026-09-01T12:00:00Z"),
    topKg,
    topReps,
    e1rmKg: e1,
    e1rmSetKg: reliable ? topKg : null,
    e1rmSetReps: reliable ? topReps : null,
    bestReps: topReps,
    bestRepsKg: topKg,
    totalReps: topReps * 3,
    volumeKg: topKg * topReps * 3,
    sets: 3,
    ...p,
  };
}

describe("progressMode", () => {
  it("measures loaded lifts in kilos and unloaded ones in reps or seconds", () => {
    expect(progressMode([{ topKg: 60 }], { bodyweight: false, timed: false })).toBe("load");
    expect(progressMode([{ topKg: 0 }, { topKg: 0 }], { bodyweight: true, timed: false })).toBe("reps");
    expect(progressMode([{ topKg: 0 }], { bodyweight: true, timed: true })).toBe("time");
    expect(progressMode([{ topKg: 10 }], { bodyweight: false, timed: true })).toBe("loaded-time");
  });

  it("keeps a bodyweight exercise with an occasional vest in reps", () => {
    expect(progressMode([{ topKg: 0 }, { topKg: 0 }, { topKg: 10 }], { bodyweight: true, timed: false })).toBe("reps");
    expect(progressMode([{ topKg: 0 }, { topKg: 10 }, { topKg: 10 }], { bodyweight: true, timed: false })).toBe("load");
  });
});

describe("compareSessions", () => {
  it("compares e1RM when both sessions allow it: 60 × 8 → 65 × 6 is a gain", () => {
    const c = compareSessions(perf({ topKg: 60, topReps: 8 }), perf({ topKg: 65, topReps: 6 }), "load")!;
    expect(c.metric).toBe("e1rm");
    expect(c.direction).toBe("up");
    expect(c.pctText).toBe("+3%"); // e1RM 76 → 78 kg
    expect(c.detail).toBe(`60${NBSP}kg × 8 → 65${NBSP}kg × 6`);
  });

  it("shows a rep gain at the same load instead of a false 'no data'", () => {
    const c = compareSessions(perf({ topKg: 60, topReps: 12 }), perf({ topKg: 60, topReps: 13 }), "load")!;
    expect(c.metric).toBe("reps-at-load");
    expect(c.pctText).toBe("+8%");
    expect(c.detail).toBe(`+1 rep com 60${NBSP}kg`);
  });

  it("falls back to the load when reps are too high for an e1RM and the load changed", () => {
    const c = compareSessions(perf({ topKg: 40, topReps: 15 }), perf({ topKg: 45, topReps: 12 }), "load")!;
    expect(c.metric).toBe("load");
    expect(c.pctText).toBe("+13%");
    expect(c.detail).toBe(`40${NBSP}kg × 15 → 45${NBSP}kg × 12`);
  });

  it("marks drops with a true minus (never as a gain) and tiny changes as maintenance", () => {
    const drop = compareSessions(perf({ topKg: 62.5, topReps: 8 }), perf({ topKg: 60, topReps: 8 }), "load")!;
    expect(drop.direction).toBe("down");
    expect(drop.pctText).toBe(`${MINUS}4%`);
    const same = compareSessions(perf({ topKg: 60, topReps: 12 }), perf({ topKg: 60, topReps: 12 }), "load")!;
    expect(same.direction).toBe("flat");
    expect(same.pctText).toBe("manutenção");
  });

  it("measures bodyweight in reps and holds in seconds", () => {
    const bw = compareSessions(perf({ topKg: 0, bestReps: 10 }), perf({ topKg: 0, bestReps: 12 }), "reps")!;
    expect(bw.detail).toBe("10 → 12 reps");
    expect(bw.pctText).toBe("+20%");
    const hold = compareSessions(perf({ topKg: 0, bestReps: 30 }), perf({ topKg: 0, bestReps: 45 }), "time")!;
    expect(hold.detail).toBe(`30 → 45${NBSP}s`);
  });

  it("speaks seconds for a loaded hold at the same load", () => {
    const c = compareSessions(perf({ topKg: 10, topReps: 28 }), perf({ topKg: 10, topReps: 30 }), "loaded-time")!;
    expect(c.metric).toBe("time-at-load");
    expect(c.detail).toBe(`+2${NBSP}s com 10${NBSP}kg`);
    expect(c.detail).not.toContain("rep");
  });

  it("has nothing to compare without a load in load mode", () => {
    expect(compareSessions(perf({ topKg: 0 }), perf({ topKg: 60 }), "load")).toBeNull();
  });
});

describe("lists and records", () => {
  it("prints a session's best set per mode", () => {
    expect(bestSetText(perf({ topKg: 65, topReps: 6 }), "load")).toBe(`65${NBSP}kg × 6`);
    expect(bestSetText(perf({ topKg: 0, bestReps: 12, bestRepsKg: 0 }), "reps")).toBe(`PC${NBSP}×${NBSP}12`);
    // A bodyweight exercise done with a vest that day keeps its load.
    expect(bestSetText(perf({ topKg: 10, bestReps: 12, bestRepsKg: 10 }), "reps")).toBe(`10${NBSP}kg × 12`);
    expect(bestSetText(perf({ topKg: 0, bestReps: 45, bestRepsKg: 0 }), "time")).toBe(`45${NBSP}s`);
  });

  it("sorts gains first, then maintenance, then drops", () => {
    const row = (namePt: string, pct: number) => ({ namePt, comparison: { pct } as never });
    const sorted = [row("B", -0.02), row("A", 0), row("C", 0.1)].sort(byGain).map((r) => r.namePt);
    expect(sorted).toEqual(["C", "A", "B"]);
  });

  it("labels records, in seconds for holds", () => {
    expect(describePr({ kind: "MAX_WEIGHT", value: 62.5, weightKg: 62.5, reps: 8 })).toEqual({
      label: "Carga máxima",
      value: `62,5${NBSP}kg`,
    });
    // Bodyweight: "peso corporal" goes with the label, so the value is as short as a loaded one (it shares a phone row).
    expect(describePr({ kind: "MAX_REPS_AT_WEIGHT", value: 15, weightKg: 0, reps: 15 })).toEqual({
      label: "Repetições · peso corporal",
      value: "15 reps",
    });
    expect(describePr({ kind: "MAX_REPS_AT_WEIGHT", value: 12, weightKg: 102.5, reps: 12 })).toEqual({
      label: "Repetições",
      value: `12 reps com 102,5${NBSP}kg`,
    });
    expect(describePr({ kind: "MAX_REPS_AT_WEIGHT", value: 30, weightKg: 10, reps: 30 }, true)!.value).toBe(
      `30${NBSP}s com 10${NBSP}kg`,
    );
    expect(describePr({ kind: "ESTIMATED_1RM", value: 20, weightKg: 10, reps: 30 }, true)).toBeNull();
    expect(describePr({ kind: "SESSION_VOLUME", value: 1000, weightKg: null, reps: null })).toBeNull();
  });
});

describe("weeks on target", () => {
  const week = (done: number, target: number, extra: Partial<LedgerWeek> = {}): LedgerWeek => ({
    done,
    target,
    met: done >= target,
    partial: false,
    current: false,
    ...extra,
  });

  it("has no ratio in the user's first two weeks — a new user is never '4%'", () => {
    expect(summarizeConsistency([], false)).toEqual({ state: "not-started" });
    expect(summarizeConsistency([week(2, 5, { current: true })], true)).toEqual({ state: "early", week: 1 });
    expect(summarizeConsistency([week(2, 5, { partial: true }), week(1, 5, { current: true })], true)).toEqual({
      state: "early",
      week: 2,
    });
    expect(summarizeConsistency([week(5, 5), week(0, 5, { current: true })], true)).toEqual({ state: "early", week: 2 });
  });

  it("shows the ratio from the third week, even when the first week was short (two 5/5 weeks → 2/2)", () => {
    const third = [week(5, 5, { partial: true }), week(5, 5), week(1, 5, { current: true })];
    expect(summarizeConsistency(third, true)).toEqual({ state: "ratio", met: 2, total: 2 });
    // A short first week that fell short never counts against: 1/1, not 1/2.
    const shortStart = [week(2, 5, { partial: true }), week(5, 5), week(0, 5, { current: true })];
    expect(summarizeConsistency(shortStart, true)).toEqual({ state: "ratio", met: 1, total: 1 });
  });

  it("counts full weeks on target; a short first week and this week only once met", () => {
    const weeks = [week(2, 5, { partial: true }), week(5, 5), week(3, 5), week(5, 5), week(1, 5, { current: true })];
    expect(summarizeConsistency(weeks, true)).toEqual({ state: "ratio", met: 2, total: 3 });
    const thisWeekMet = [...weeks.slice(0, -1), week(5, 5, { current: true })];
    expect(summarizeConsistency(thisWeekMet, true)).toEqual({ state: "ratio", met: 3, total: 4 });
  });

  it("a deload week that counts is met however few workouts it had", () => {
    expect(summarizeConsistency([week(5, 5), { ...week(1, 5), met: true }], true)).toEqual({ state: "ratio", met: 2, total: 2 });
  });

  describe("consistencyOf (the streak's rows → the Progress card)", () => {
    const MON = 20_700; // any Monday's day number
    const row = (i: number, done: number, extra: Partial<WeekRow> = {}): WeekRow => ({
      monday: MON + i * 7,
      enrollmentId: "e",
      done,
      target: 5,
      met: done >= 5,
      deload: false,
      current: false,
      trained: done > 0,
      ...extra,
    });

    it("gives 2/2 in the third week after two complete weeks (the first one begun on a Monday)", () => {
      const rows = [row(0, 5), row(1, 5), row(2, 1, { current: true })];
      expect(consistencyOf(rows, "8w")).toMatchObject({ state: "ratio", met: 2, total: 2 });
    });

    it("says 'Primeira semana' in the first week and 'Segunda semana' in the second", () => {
      expect(consistencyOf([row(0, 2, { current: true })], "8w")).toMatchObject({ state: "early", week: 1 });
      expect(consistencyOf([row(0, 5), row(1, 0, { current: true })], "8w")).toMatchObject({ state: "early", week: 2 });
    });

    it("counts a deload week with one workout, and this week only once met", () => {
      const rows = [row(0, 5), row(1, 3), row(2, 1, { met: true, deload: true }), row(3, 5, { current: true })];
      // 5/5 (first week, met), 3/5, deload with 1 ✓, this week 5/5 ✓ → 3/4.
      expect(consistencyOf(rows, "all")).toMatchObject({ state: "ratio", met: 3, total: 4 });
    });

    it("a short entry week (the streak's neutral week) never counts against; met, it counts", () => {
      // 5/5, 5/5, 5/5, a switch's entry week at 1/4, this week open → 3/3, as Today's "3 semanas seguidas".
      const rows = [row(0, 5), row(1, 5), row(2, 5), row(3, 1, { target: 4, neutral: true }), row(4, 0, { current: true })];
      expect(consistencyOf(rows, "8w")).toMatchObject({ state: "ratio", met: 3, total: 3 });
      const met = [row(0, 5), row(1, 5), row(2, 5), row(3, 4, { target: 4, met: true, neutral: true }), row(4, 0, { current: true })];
      expect(consistencyOf(met, "8w")).toMatchObject({ state: "ratio", met: 4, total: 4 });
    });

    it("reads the period's last full weeks, never before the first workout", () => {
      const rows = [row(0, 5), ...Array.from({ length: 9 }, (_, i) => row(i + 1, i % 2 ? 5 : 0)), row(10, 0, { current: true })];
      // 4w: weeks 7–10 → 5, 0, 5, 0 → 2/4, since week 7's Monday.
      const four = consistencyOf(rows, "4w");
      expect(four).toMatchObject({ state: "ratio", met: 2, total: 4 });
      expect(consistencyOf([row(0, 0, { current: true })], "4w")).toMatchObject({ state: "not-started", since: null });
    });
  });

  describe("periodStartDate (one span for every number on Progress)", () => {
    // Sunday 27 Sep 2026, 21:00 in São Paulo (already Monday in UTC).
    const sunday = new Date("2026-09-28T00:00:00Z");

    it("opens on the Monday of the period's first full week, 00:00 São Paulo — not 'now − 56 days'", () => {
      expect(periodStartDate("8w", sunday)?.toISOString()).toBe("2026-07-27T03:00:00.000Z");
      expect(periodStartDate("4w", sunday)?.toISOString()).toBe("2026-08-24T03:00:00.000Z");
      expect(periodStartDate("1y", sunday)?.toISOString()).toBe("2025-09-22T03:00:00.000Z");
      expect(periodStartDate("all", sunday)).toBeNull();
      // Monday 00:30 in São Paulo: a new week, so the window moves on by one.
      expect(periodStartDate("8w", new Date("2026-09-28T03:30:00Z"))?.toISOString()).toBe("2026-08-03T03:00:00.000Z");
    });

    it("starts exactly where 'semanas na meta' starts, for every period", () => {
      const thisMonday = mondayOf(dayNumberOf(sunday));
      const rows: WeekRow[] = Array.from({ length: 60 }, (_, i) => ({
        monday: thisMonday - (59 - i) * 7,
        enrollmentId: null,
        done: 3,
        target: 3,
        met: true,
        deload: false,
        current: i === 59,
        trained: true,
      }));
      for (const period of ["4w", "8w", "3m", "6m", "1y"] as const) {
        expect(consistencyOf(rows, period).since?.toISOString()).toBe(periodStartDate(period, sunday)?.toISOString());
      }
    });
  });
});
