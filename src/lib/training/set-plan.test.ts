import { describe, expect, it } from "vitest";
import {
  adviceFromLastTime,
  adviceInSeconds,
  firstTimeReps,
  formatDecimal,
  formatSet,
  isBodyweightEquipment,
  isExerciseDone,
  isTimedHold,
  parseDecimalInput,
  planRows,
  progressionPrincipleSlug,
  suggestFor,
  warmupSuggestions,
  type PlanSet,
} from "./set-plan";

let n = 0;
function set(partial: Partial<PlanSet>): PlanSet {
  n++;
  return {
    id: `s${n}`,
    setNumber: n,
    setType: "WORKING",
    isExtra: false,
    isCompleted: false,
    weightKg: null,
    reps: null,
    ...partial,
  };
}

describe("planRows", () => {
  it("splits warm-ups, prescribed and extras with their own 1-based ordinals", () => {
    const sets = [
      set({ setNumber: 1, setType: "WARMUP" }),
      set({ setNumber: 2, setType: "WARMUP" }),
      set({ setNumber: 3 }),
      set({ setNumber: 4 }),
      set({ setNumber: 5 }),
      set({ setNumber: 6, isExtra: true }),
    ];
    const { warmups, prescribed, extras } = planRows(sets);
    expect(warmups.map((r) => r.ordinal)).toEqual([1, 2]);
    expect(prescribed.map((r) => [r.set.setNumber, r.ordinal])).toEqual([
      [3, 1],
      [4, 2],
      [5, 3],
    ]);
    expect(extras.map((r) => [r.kind, r.ordinal])).toEqual([["EXTRA", 1]]);
  });

  it("orders by setNumber regardless of input order", () => {
    const sets = [set({ setNumber: 3 }), set({ setNumber: 1 }), set({ setNumber: 2 })];
    expect(planRows(sets).prescribed.map((r) => r.set.setNumber)).toEqual([1, 2, 3]);
  });
});

describe("isExerciseDone", () => {
  it("needs every prescribed set, ignoring warm-ups and extras", () => {
    const sets = [
      set({ setNumber: 1, setType: "WARMUP" }),
      set({ setNumber: 2, isCompleted: true }),
      set({ setNumber: 3, isCompleted: true }),
      set({ setNumber: 4, isExtra: true }),
    ];
    expect(isExerciseDone(sets)).toBe(true);
    expect(isExerciseDone([...sets, set({ setNumber: 5 })])).toBe(false);
  });

  it("counts a skipped exercise as done", () => {
    expect(isExerciseDone([set({})], true)).toBe(true);
  });
});

describe("suggestFor", () => {
  const previous = [
    { weightKg: 40, reps: 10 },
    { weightKg: 42.5, reps: 9 },
    { weightKg: 42.5, reps: 8 },
    { weightKg: 20, reps: 15, isExtra: true },
  ];
  const ctx = { previous };

  it("matches last time's set by working-set position, not raw setNumber", () => {
    expect(suggestFor("PRESCRIBED", 1, null, ctx)).toEqual({ weightKg: 40, reps: 10 });
    expect(suggestFor("PRESCRIBED", 3, null, ctx)).toEqual({ weightKg: 42.5, reps: 8 });
  });

  it("carries today's load from the row above, keeping last time's reps", () => {
    expect(suggestFor("PRESCRIBED", 2, { weightKg: 45, reps: 10 }, ctx)).toEqual({ weightKg: 45, reps: 9 });
  });

  it("falls back to last time's last prescribed set beyond its count", () => {
    expect(suggestFor("PRESCRIBED", 5, null, ctx)).toEqual({ weightKg: 42.5, reps: 8 });
  });

  it("suggests the progression's load and reps over a copy of last time", () => {
    const target = { kind: "increase" as const, loadKg: 45, targetReps: 8 };
    expect(suggestFor("PRESCRIBED", 1, null, { previous, target })).toEqual({ weightKg: 45, reps: 8 });
    expect(suggestFor("PRESCRIBED", 3, null, { previous, target })).toEqual({ weightKg: 45, reps: 8 });
    // What the user just lifted still wins for the load.
    expect(suggestFor("PRESCRIBED", 2, { weightKg: 42.5, reps: 8 }, { previous, target })).toEqual({
      weightKg: 42.5,
      reps: 8,
    });
    // A hold without a rep target keeps last time's reps.
    expect(
      suggestFor("PRESCRIBED", 2, null, { previous, target: { kind: "hold", loadKg: 42.5, targetReps: null } }),
    ).toEqual({
      weightKg: 42.5,
      reps: 9,
    });
  });

  it("holding the load, never asks a set for fewer reps than it did last time at that load", () => {
    // Last time 40 kg × 12, 10, 9 on 8–12: "Mantenha 40 kg · busque 10 reps".
    const last = [12, 10, 9].map((reps) => ({ weightKg: 40, reps }));
    const hold = { kind: "hold" as const, loadKg: 40, targetReps: 10 };
    const reps = [1, 2, 3].map((n) => suggestFor("PRESCRIBED", n, null, { previous: last, target: hold }).reps);
    expect(reps).toEqual([12, 10, 10]);
    // A different load today (typed in the row above): last time's reps at 40 kg don't apply.
    expect(suggestFor("PRESCRIBED", 2, { weightKg: 45, reps: 8 }, { previous: last, target: hold })).toEqual({
      weightKg: 45,
      reps: 10,
    });
    // Below the range ("complete 8 reps"): the target is the floor.
    const below = [8, 8, 6].map((r) => ({ weightKg: 40, reps: r }));
    const complete = { kind: "hold" as const, loadKg: 40, targetReps: 8 };
    expect([1, 2, 3].map((n) => suggestFor("PRESCRIBED", n, null, { previous: below, target: complete }).reps)).toEqual([
      8, 8, 8,
    ]);
    // Going up a load, the new load starts from the bottom of the range.
    const up = { kind: "increase" as const, loadKg: 42.5, targetReps: 8 };
    expect(suggestFor("PRESCRIBED", 1, null, { previous: last, target: up })).toEqual({ weightKg: 42.5, reps: 8 });
  });

  it("never applies the progression to extras", () => {
    expect(suggestFor("EXTRA", 1, null, { previous, target: { kind: "increase", loadKg: 45, targetReps: 8 } })).toEqual({
      weightKg: 20,
      reps: 15,
    });
  });

  it("leaves warm-ups to warmupSuggestions", () => {
    expect(suggestFor("WARMUP", 1, { weightKg: 45, reps: 10 }, ctx)).toEqual({ weightKg: null, reps: null });
  });

  it("with no history suggests only the prescribed reps, so ✓ just needs the load", () => {
    expect(suggestFor("PRESCRIBED", 1, null, { previous: [] })).toEqual({ weightKg: null, reps: null });
    expect(suggestFor("PRESCRIBED", 1, null, { previous: [], prescribedReps: 12 })).toEqual({ weightKg: null, reps: 12 });
    // The row above (just lifted) comes before the prescription.
    expect(suggestFor("PRESCRIBED", 2, { weightKg: 30, reps: 10 }, { previous: [], prescribedReps: 12 })).toEqual({
      weightKg: 30,
      reps: 10,
    });
  });
});

describe("bodyweight exercises", () => {
  it("are the BODYWEIGHT and NONE equipment categories", () => {
    expect(isBodyweightEquipment("BODYWEIGHT")).toBe(true);
    expect(isBodyweightEquipment("NONE")).toBe(true);
    expect(isBodyweightEquipment("FREE_WEIGHT")).toBe(false);
    expect(isBodyweightEquipment("SPECIALTY")).toBe(false);
    expect(isBodyweightEquipment(null)).toBe(false);
  });

  it("suggest 0 kg (no extra load), so ✓ needs nothing typed on a first time", () => {
    expect(suggestFor("PRESCRIBED", 1, null, { previous: [], prescribedReps: 15, bodyweight: true })).toEqual({
      weightKg: 0,
      reps: 15,
    });
    // Extra load lifted last time, or typed in the row above, still comes first.
    expect(
      suggestFor("PRESCRIBED", 1, null, { previous: [{ weightKg: 10, reps: 8 }], prescribedReps: 10, bodyweight: true }),
    ).toEqual({ weightKg: 10, reps: 8 });
    expect(
      suggestFor("PRESCRIBED", 2, { weightKg: 5, reps: 9 }, { previous: [], prescribedReps: 10, bodyweight: true }),
    ).toEqual({ weightKg: 5, reps: 9 });
    // Warm-ups are still left to warmupSuggestions.
    expect(suggestFor("WARMUP", 1, null, { previous: [], bodyweight: true })).toEqual({ weightKg: null, reps: null });
  });
});

describe("isTimedHold", () => {
  it("knows the holds whose reps are always seconds", () => {
    expect(isTimedHold({ slug: "plank" })).toBe(true);
    expect(isTimedHold({ slug: "side-bridge" })).toBe(true);
    // Loaded, timed by every program that uses it: the summary and the
    // exercise history (which know only the slug) must say seconds too.
    expect(isTimedHold({ slug: "plate-pinch" })).toBe(true);
    expect(isTimedHold({ slug: "pushups" })).toBe(false);
    expect(isTimedHold({ slug: "body-up", notes: null })).toBe(false);
  });

  it("reads program notes that say the numbers are seconds", () => {
    for (const notes of [
      "Os números são o tempo em segundos. Aperte os glúteos.",
      "Os números são SEGUNDOS (20-40 s por série). Contraia glúteos e abdômen.",
      "As repetições são segundos. Mantenha glúteos e abdômen contraídos.",
      "Aqui as repetições significam segundos de sustentação.",
      "Prancha isométrica de 30 a 60 segundos por série (aqui as 'reps' representam segundos).",
      "As 'reps' são segundos de sustentação: mantenha 20 a 40 s por série.",
      "As repetições = segundos de sustentação por mão.",
      "SEGUNDOS de sustentação por lado, não repetições. Quadril alto.",
    ]) {
      expect(isTimedHold({ slug: "some-hold", notes }), notes).toBe(true);
    }
  });

  it("doesn't take a loose mention of seconds for a timed hold", () => {
    for (const notes of [
      "Progrida por reps e por tempo (2 a 3 s na descida).",
      "Os números são metros (ou segundos) por série.",
      "Contrações isométricas de ~10 s (cada rep = uma sustentação).",
      "Desça em 3 segundos até alongar o peito.",
    ]) {
      expect(isTimedHold({ slug: "x", notes }), notes).toBe(false);
    }
  });
});

describe("formatSet", () => {
  const plain = (s: string) => s.replace(/\u00a0/g, " ");
  it("prints load × reps, and no '0 kg ×' for a set without load", () => {
    expect(plain(formatSet(60, 10))).toBe("60 kg × 10");
    expect(plain(formatSet(42.5, 8))).toBe("42,5 kg × 8");
    expect(plain(formatSet(0, 12))).toBe("× 12");
    expect(plain(formatSet(null, 12))).toBe("— × 12");
    expect(plain(formatSet(60, null))).toBe("60 kg × —");
  });

  it("prints a hold's reps as seconds", () => {
    expect(plain(formatSet(0, 45, { timed: true }))).toBe("45 s");
    expect(plain(formatSet(10, 30, { timed: true }))).toBe("10 kg × 30 s");
    expect(plain(formatSet(0, null, { timed: true }))).toBe("—");
  });
});

describe("firstTimeReps", () => {
  it("aims for the top of a hypertrophy range and the bottom of a heavy one", () => {
    expect(firstTimeReps(8, 12)).toBe(12);
    expect(firstTimeReps(5, 8)).toBe(8);
    expect(firstTimeReps(3, 5)).toBe(3);
    expect(firstTimeReps(4, 6)).toBe(4);
    expect(firstTimeReps(0, 0)).toBeNull();
  });

  it("with the body's own weight, aims for the bottom of the range", () => {
    expect(firstTimeReps(8, 15, { bodyweight: true })).toBe(8);
    expect(firstTimeReps(20, 45, { bodyweight: true })).toBe(20);
    expect(firstTimeReps(10, 10, { bodyweight: true })).toBe(10);
    expect(firstTimeReps(0, 0, { bodyweight: true })).toBeNull();
  });
});

describe("warmupSuggestions", () => {
  it("ramps ~50% × 8 and ~70% × 4 of the working load, on the load step", () => {
    expect(warmupSuggestions(2, 100, 2.5)).toEqual([
      { weightKg: 50, reps: 8 },
      { weightKg: 70, reps: 4 },
    ]);
    expect(warmupSuggestions(2, 62.5, 2.5)).toEqual([
      { weightKg: 32.5, reps: 8 },
      { weightKg: 45, reps: 4 },
    ]);
    expect(warmupSuggestions(1, 80, 2.5)).toEqual([{ weightKg: 47.5, reps: 5 }]);
    expect(warmupSuggestions(3, 100, 5)).toEqual([
      { weightKg: 40, reps: 8 },
      { weightKg: 60, reps: 5 },
      { weightKg: 80, reps: 3 },
    ]);
  });

  it("has one entry per warm-up, empty without a known load or when it rounds to nothing", () => {
    expect(warmupSuggestions(2, null, 2.5)).toEqual([
      { weightKg: null, reps: null },
      { weightKg: null, reps: null },
    ]);
    expect(warmupSuggestions(1, 2.5, 2.5)).toEqual([{ weightKg: null, reps: null }]);
    expect(warmupSuggestions(4, 100, 2.5)).toHaveLength(4);
    expect(warmupSuggestions(0, 100, 2.5)).toEqual([]);
  });
});

describe("adviceFromLastTime", () => {
  const prescribed = { repMin: 5, repMax: 8, rirTarget: 2 };
  const done = (w: number, reps: number[], isExtra = false) =>
    reps.map((r) => ({ weightKg: w, reps: r, rir: 2, isExtra }));

  it("goes up once every prescribed set hit the top of the range", () => {
    const a = adviceFromLastTime({
      strategy: "DOUBLE",
      prescribed,
      lastTime: { sets: done(60, [8, 8, 8, 8]), prescribedSets: 4 },
      loadIncrementKg: 2.5,
    });
    expect(a).toMatchObject({ kind: "increase", loadKg: 62.5, targetReps: 5 });
  });

  it("ignores extras: they neither count toward nor block the prescription", () => {
    const a = adviceFromLastTime({
      strategy: "DOUBLE",
      prescribed,
      lastTime: { sets: [...done(60, [8, 8, 8, 8]), ...done(40, [3], true)], prescribedSets: 4 },
      loadIncrementKg: 2.5,
    });
    expect(a?.kind).toBe("increase");
  });

  it("holds the load when fewer sets than prescribed were done", () => {
    const a = adviceFromLastTime({
      strategy: "DOUBLE",
      prescribed,
      lastTime: { sets: done(60, [8]), prescribedSets: 4 },
      loadIncrementKg: 2.5,
    });
    expect(a).toMatchObject({ kind: "hold", loadKg: 60, targetReps: null });
    expect(a?.headline).toContain("faça as 4 séries");
  });

  it("uses the program's load step and says nothing without history", () => {
    const a = adviceFromLastTime({
      strategy: "LINEAR_LOAD",
      prescribed,
      lastTime: { sets: done(100, [5, 5, 5]), prescribedSets: 3 },
      loadIncrementKg: 5,
    });
    expect(a).toMatchObject({ kind: "increase", loadKg: 105 });
    expect(adviceFromLastTime({ strategy: "DOUBLE", prescribed, lastTime: null, loadIncrementKg: 2.5 })).toBeNull();
    expect(
      adviceFromLastTime({ strategy: "DOUBLE", prescribed, lastTime: { sets: done(20, [8], true), prescribedSets: 0 }, loadIncrementKg: 2.5 }),
    ).toBeNull();
  });

  it("speaks in seconds for a loaded hold (plate-pinch)", () => {
    const pinch = { repMin: 20, repMax: 30, rirTarget: 1 };
    const sec = (t: string | undefined) => (t ?? "").replace(/\u00a0/g, " ");
    const hold = adviceFromLastTime({
      strategy: "DOUBLE",
      prescribed: pinch,
      lastTime: { sets: [30, 25, 22].map((r) => ({ weightKg: 10, reps: r, rir: 1, isExtra: false })), prescribedSets: 3 },
      loadIncrementKg: 2.5,
      timed: true,
    });
    expect(hold).toMatchObject({ kind: "hold", loadKg: 10, targetReps: 23 });
    expect(sec(hold?.headline)).toBe("Mantenha 10 kg · segure 23 s");
    expect(sec(hold?.reason)).toBe("Suba a carga quando segurar 30 s em todas");

    const up = adviceFromLastTime({
      strategy: "DOUBLE",
      prescribed: pinch,
      lastTime: { sets: [30, 30, 30].map((r) => ({ weightKg: 10, reps: r, rir: 1, isExtra: false })), prescribedSets: 3 },
      loadIncrementKg: 2.5,
      timed: true,
    });
    expect(up).toMatchObject({ kind: "increase", loadKg: 12.5 });
    expect(sec(up?.reason)).toBe("30 s em todas as séries com RIR ≥ 1");
    expect(`${up?.headline} ${up?.reason}`).not.toMatch(/reps/);

    const same = adviceFromLastTime({
      strategy: "DOUBLE",
      prescribed: pinch,
      lastTime: { sets: [30, 25, 22].map((r) => ({ weightKg: 10, reps: r, rir: 1, isExtra: false })), prescribedSets: 3 },
      loadIncrementKg: 2.5,
    });
    expect(same?.headline).toContain("busque 23 reps");
  });

  it("rewrites every reps wording next-load uses into seconds", () => {
    const sec = (headline: string, reason: string) => {
      const a = adviceInSeconds({ headline, reason });
      return `${a.headline} | ${a.reason}`.replace(/\u00a0/g, " ");
    };
    expect(sec("Mantenha 10 kg · complete 20 reps", "Alguma série ficou abaixo de 20 reps")).toBe(
      "Mantenha 10 kg · segure 20 s | Alguma série ficou abaixo de 20 s",
    );
    expect(sec("↑ Suba para 12,5 kg", "20+ reps em todas as séries")).toBe("↑ Suba para 12,5 kg | 20+ s em todas as séries");
    expect(
      sec(
        "Mantenha 10 kg · 30 reps com RIR 1",
        "Fez 30 reps em todas, mas com RIR 0 (alvo 1) — suba quando sobrarem mais reps",
      ),
    ).toBe("Mantenha 10 kg · 30 s com RIR 1 | Segurou 30 s em todas, mas com RIR 0 (alvo 1) — suba quando sobrarem mais segundos");
    expect(sec("Mantenha 10 kg · todas as séries com essa carga", "Suba quando fizer 30 reps em todas as séries com 10 kg")).toBe(
      "Mantenha 10 kg · todas as séries com essa carga | Suba quando segurar 30 s em todas as séries com 10 kg",
    );
  });

  it("links each strategy to its science page", () => {
    expect(progressionPrincipleSlug(null)).toBe("double-progression");
    expect(progressionPrincipleSlug("LINEAR_LOAD")).toBe("progressive-overload");
    expect(progressionPrincipleSlug("RIR_BASED")).toBe("rir");
    expect(progressionPrincipleSlug("MANUAL")).toBeNull();
  });
});

describe("parseDecimalInput / formatDecimal", () => {
  it("accepts pt-BR comma and dot decimals", () => {
    expect(parseDecimalInput("42,5")).toBe(42.5);
    expect(parseDecimalInput(" 42.5 ")).toBe(42.5);
    expect(parseDecimalInput("10")).toBe(10);
    expect(parseDecimalInput(",5")).toBe(0.5);
  });

  it("rejects empty and garbage", () => {
    expect(parseDecimalInput("")).toBeNull();
    expect(parseDecimalInput(",")).toBeNull();
    expect(parseDecimalInput("abc")).toBeNull();
    expect(parseDecimalInput("4,2,5")).toBeNull();
    expect(parseDecimalInput("-5")).toBeNull();
  });

  it("formats with a comma and drops trailing zeros", () => {
    expect(formatDecimal(42.5)).toBe("42,5");
    expect(formatDecimal(40)).toBe("40");
    expect(formatDecimal(null)).toBe("");
  });
});
