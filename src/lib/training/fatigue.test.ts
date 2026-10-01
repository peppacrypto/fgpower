import { describe, expect, it } from "vitest";
import {
  ANCHOR_NOTE,
  deloadSets,
  detectFatigue,
  fatigueLevel,
  keyExercises,
  repsDrop,
  type AnchorSession,
  type CheckInAnswers,
} from "./fatigue";

const NOW = new Date("2026-09-28T15:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const at = (n: number, topKg: number, topReps: number, e1rmKg: number | null = null): AnchorSession => ({
  date: daysAgo(n),
  topKg,
  topReps,
  e1rmKg,
});
const checkIn = (patch: Partial<CheckInAnswers> = {}): CheckInAnswers => ({
  soreness: null,
  shortSleep: false,
  lingeringPain: false,
  highStress: false,
  ...patch,
});

describe("ANCHOR_NOTE", () => {
  it("finds the GD key exercises' notes, accents and case aside", () => {
    for (const note of [
      "Âncora + benchmark (testado na sem. 13). Pegada ~1,5x…",
      "TOP SETS (âncora + benchmark): 3 x 3-5, nunca até a falha.",
      "Benchmark de puxada vertical (testado na semana 13)",
      "Âncora do terra",
      "BENCHMARK (teste na semana 13).",
    ]) {
      expect(ANCHOR_NOTE.test(note), note).toBe(true);
    }
  });

  it("never matches inside another word", () => {
    expect(ANCHOR_NOTE.test("Boa ancoragem dos pés no chão")).toBe(false);
    expect(ANCHOR_NOTE.test("Superâncora")).toBe(false);
    expect(ANCHOR_NOTE.test("benchmarks")).toBe(false);
  });
});

describe("keyExercises", () => {
  const ex = (exerciseId: string, sortOrder: number, notes: string | null = null, slug = exerciseId, category = "STRENGTH") => ({
    exerciseId,
    slug,
    notes,
    sortOrder,
    category,
  });

  it("takes the program's anchors and benchmarks, deduped", () => {
    const keys = keyExercises([
      { exercises: [ex("supino", 0, "Âncora do dia."), ex("crucifixo", 1)] },
      { exercises: [ex("terra", 0, "Âncora de força"), ex("supino", 1, "Âncora do dia.")] },
    ]);
    expect(keys).toEqual({ exerciseIds: ["supino", "terra"], source: "anchors" });
  });

  it("falls back to each day's first exercise, skipping holds, stretches and cardio, at most 8", () => {
    const keys = keyExercises([
      { exercises: [ex("prancha", 0, null, "plank"), ex("agachamento", 1)] },
      { exercises: [ex("alongamento", 0, null, "alongamento", "STRETCHING"), ex("remada", 1)] },
      { exercises: [ex("agachamento", 0), ex("supino", 1)] },
      { exercises: [] },
      ...Array.from({ length: 8 }, (_, i) => ({ exercises: [ex(`x${i}`, 0)] })),
    ]);
    expect(keys.source).toBe("first");
    expect(keys.exerciseIds).toEqual(["agachamento", "remada", "x0", "x1", "x2", "x3", "x4", "x5"]);
  });
});

describe("repsDrop", () => {
  it("fires on 2+ fewer reps at the same load, two sessions running", () => {
    expect(repsDrop("Supino Reto", [at(15, 60, 8), at(8, 60, 6), at(2, 60, 6)], NOW)).toBe(
      "Supino Reto (60 kg: 8 → 6 → 6)",
    );
  });

  it("fires on an e1RM 5% lower at another load, twice", () => {
    expect(repsDrop("Agachamento", [at(15, 100, 5, 116.7), at(8, 95, 5, 110.8), at(2, 95, 4, 107.7)], NOW)).toBe(
      "Agachamento (1RM est. 116,7 → 110,8 → 107,7 kg)",
    );
  });

  it("never fires on one bad day, a recovery, a heavier load within 5%, or an old drop", () => {
    // 8 → 6 → 8: back up.
    expect(repsDrop("A", [at(15, 60, 8), at(8, 60, 6), at(2, 60, 8)], NOW)).toBeNull();
    // A single bad day.
    expect(repsDrop("A", [at(15, 60, 8), at(8, 60, 8), at(2, 60, 6)], NOW)).toBeNull();
    // 62,5 × 6 after 60 × 8: fewer reps, heavier, e1RM within 5%.
    expect(repsDrop("A", [at(15, 60, 8, 76), at(8, 62.5, 6, 75), at(2, 62.5, 6, 75)], NOW)).toBeNull();
    // The last session 11 days ago.
    expect(repsDrop("A", [at(25, 60, 8), at(18, 60, 6), at(11, 60, 6)], NOW)).toBeNull();
    expect(repsDrop("A", [at(8, 60, 8), at(2, 60, 6)], NOW)).toBeNull();
  });
});

describe("detectFatigue / fatigueLevel", () => {
  const dropping = { name: "Supino", sessions: [at(15, 60, 10), at(8, 60, 8), at(2, 60, 8)] };
  const dropping2 = { name: "Terra", sessions: [at(14, 100, 8), at(7, 100, 6), at(1, 100, 5)] };
  const steady = { name: "Remada", sessions: [at(14, 50, 10), at(7, 50, 10), at(1, 50, 11)] };

  it("reps: 2 key exercises dropping", () => {
    const one = detectFatigue({ anchors: [dropping, steady], checkIns: [], daysPerWeek: 5, now: NOW });
    expect(one).toEqual([]);
    const two = detectFatigue({ anchors: [dropping, dropping2, steady], checkIns: [], daysPerWeek: 5, now: NOW });
    expect(two.map((t) => t.key)).toEqual(["reps"]);
    expect(two[0].text).toContain("Supino (60 kg: 10 → 8 → 8); Terra (100 kg: 8 → 6 → 5)");
    expect(fatigueLevel(two, false)).toBe("watch");
  });

  it("sleep: 3 check-ins (2 on a plan of 3 days a week or fewer)", () => {
    const two = [checkIn({ shortSleep: true }), checkIn({ shortSleep: true }), checkIn()];
    expect(detectFatigue({ anchors: [], checkIns: two, daysPerWeek: 5, now: NOW })).toEqual([]);
    expect(detectFatigue({ anchors: [], checkIns: two, daysPerWeek: 3, now: NOW })).toEqual([
      { key: "sleep", text: "Menos de 6 h de sono em 2 check-ins", count: 2 },
    ]);
    const three = [...two, checkIn({ shortSleep: true })];
    expect(detectFatigue({ anchors: [], checkIns: three, daysPerWeek: 5, now: NOW }).map((t) => t.key)).toEqual(["sleep"]);
  });

  it("pain: the chip once, or soreness 6+ twice; stress: twice", () => {
    expect(detectFatigue({ anchors: [], checkIns: [checkIn({ lingeringPain: true })], daysPerWeek: 5, now: NOW })).toEqual([
      { key: "pain", text: "Dor articular ou dor > 72 h marcada em 1 check-in", count: 1 },
    ]);
    const sore = [checkIn({ soreness: 6 }), checkIn({ soreness: 5 })];
    expect(detectFatigue({ anchors: [], checkIns: sore, daysPerWeek: 5, now: NOW })).toEqual([]);
    const sorer = [checkIn({ soreness: 6 }), checkIn({ soreness: 8 })];
    expect(detectFatigue({ anchors: [], checkIns: sorer, daysPerWeek: 5, now: NOW })[0].text).toBe(
      "Dor muscular 6+/10 em 2 check-ins",
    );
    expect(detectFatigue({ anchors: [], checkIns: [checkIn({ highStress: true })], daysPerWeek: 5, now: NOW })).toEqual([]);
    expect(
      detectFatigue({ anchors: [], checkIns: [checkIn({ highStress: true }), checkIn({ highStress: true })], daysPerWeek: 5, now: NOW }),
    ).toEqual([{ key: "stress", text: "Estresse alto ou pouca motivação em 2 check-ins", count: 2 }]);
  });

  it("2+ triggers suggest a deload — or wait for the program's own next week", () => {
    const triggers = detectFatigue({
      anchors: [dropping, dropping2],
      checkIns: [checkIn({ shortSleep: true }), checkIn({ shortSleep: true }), checkIn({ shortSleep: true })],
      daysPerWeek: 5,
      now: NOW,
    });
    expect(triggers.map((t) => t.key)).toEqual(["reps", "sleep"]);
    expect(fatigueLevel(triggers, false)).toBe("deload");
    expect(fatigueLevel(triggers, true)).toBe("deload-next");
    // One trigger other than reps says nothing; none, nothing.
    expect(fatigueLevel([{ key: "sleep", text: "", count: 3 }], false)).toBeNull();
    expect(fatigueLevel([], false)).toBeNull();
  });
});

describe("deloadSets", () => {
  it("halves the working sets, rounding down, at least 1", () => {
    expect([5, 4, 3, 2, 1].map(deloadSets)).toEqual([2, 2, 1, 1, 1]);
    expect(deloadSets(0)).toBe(0);
  });
});
