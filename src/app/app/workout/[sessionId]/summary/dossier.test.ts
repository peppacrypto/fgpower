import { describe, expect, it } from "vitest";
import { adviceFromLastTime } from "@/lib/training/set-plan";
import {
  compareWithLast,
  formatDayNumber,
  formatSpShortDate,
  setsText,
  spDayNumber,
  weekdayFromName,
  weekdayOf,
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

describe("São Paulo days", () => {
  // Friday 2026-09-25 23:30 in São Paulo = Saturday 02:30 UTC.
  const fridayNight = new Date("2026-09-26T02:30:00Z");

  it("dates by the São Paulo wall clock", () => {
    expect(formatSpShortDate(fridayNight)).toBe("sex 25 set");
    expect(weekdayOf(spDayNumber(fridayNight))).toBe(5);
    expect(formatDayNumber(spDayNumber(fridayNight) + 3)).toBe("seg 28 set");
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
