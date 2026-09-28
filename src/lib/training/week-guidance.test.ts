import { describe, expect, it } from "vitest";
import {
  baselineRir,
  completeWeekDone,
  daysLeftInWeek,
  effectiveProgramWeek,
  entryWeekTarget,
  getWeekGuidance,
  isDeloadGuidance,
  parseWeeklyGuidance,
  programWeekView,
  rirFloor,
  thisWeekRule,
  weekRirTarget,
} from "./week-guidance";

const note = (notePt: string, setsNotePt = "") => ({ notePt, setsNotePt });

describe("week guidance", () => {
  const gd1 = [
    { week: 1, rirTarget: 3, notePt: "Ache as cargas.", setsNotePt: "Introdução (~64 séries)." },
    { week: 5, rirTarget: 1, notePt: "Semanas mais duras da onda 1.", setsNotePt: "80 séries." },
    {
      week: 6,
      rirTarget: 1,
      notePt: "RIR igual à semana 5. 2+ gatilhos → a semana 7 vira deload.",
      setsNotePt: "80 séries; última semana da onda 1.",
    },
    { week: 13, rirTarget: 3.5, notePt: "Teste na ordem hack → supino.", setsNotePt: "Seg-qua: deload — mesmas cargas." },
  ];

  it("reads the week, skipping malformed entries", () => {
    expect(parseWeeklyGuidance([{ week: "x" }, null, { week: 2, rirTarget: "2.5", notePt: " a " }])).toEqual([
      { week: 2, rirTarget: 2.5, notePt: "a", setsNotePt: null },
    ]);
    expect(parseWeeklyGuidance("nope")).toEqual([]);
    expect(getWeekGuidance(gd1, 5)).toMatchObject({ week: 5, rirTarget: 1, deload: false, test: false });
    expect(getWeekGuidance(gd1, 4)).toBeNull();
    // The entry week (0) reads week 1.
    expect(getWeekGuidance(gd1, 0)?.week).toBe(1);
  });

  it("a GD block's last week is the test week (not the Adaptação bridge)", () => {
    expect(getWeekGuidance(gd1, 13, { templateSlug: "gd-1", durationWeeks: 13 })).toMatchObject({ test: true, deload: true });
    expect(getWeekGuidance(gd1, 13, { templateSlug: "upper-lower", durationWeeks: 13 })?.test).toBe(false);
    expect(getWeekGuidance(gd1, 13, { templateSlug: "gd-adaptacao", durationWeeks: 13 })?.test).toBe(false);
  });

  it("a deload is a week that says it is one — not one that mentions a possible deload", () => {
    for (const yes of [
      note("", "Deload: reduza para 2 séries por exercício."),
      note("", "DELOAD PLANEJADO: metade das séries."),
      note("", "Seg-qua: deload — mesmas cargas."),
      note("Semana de descarga planejada — não é preguiça.", ""),
      note("", "Semana leve (deload). Reduza para 2 séries."),
      note("", "Descarga final: cerca de metade das séries."),
      note("", "Semana única de deload."),
      // home-dumbbells 8, silver-strength-50plus 8, desk-worker 6, strength-for-runners 5.
      note("Descarregue a fadiga.", "Semana de consolidação: reduza para 2 séries por exercício e alivie um pouco a carga."),
      note("Pode pular a redução.", "Semana de consolidação: reduza 1 série por exercício e volte para 3 na reserva."),
      note("Mini-descarga pra assimilar o bloco e reavaliar cargas.", ""),
      note("Descarrega a fadiga acumulada.", "Semana leve planejada: reduza cerca de 10% a carga."),
    ]) {
      expect(isDeloadGuidance(yes), yes.notePt + yes.setsNotePt).toBe(true);
    }
    for (const no of [
      note("2+ gatilhos → a semana 7 vira deload.", "80 séries."),
      note("Com 2+ gatilhos, esta semana vira deload (metade das séries).", ""),
      note("Última semana de acúmulo antes da descarga.", ""),
      note("RIR igual à semana 7 (se a 7 foi deload, mantenha).", ""),
      note("2+ gatilhos: deload agora (metade das séries, RIR 3-4).", "Começa a onda 2 (regra do ano 1, não é deload)."),
      note("", "Retome o volume completo com as cargas onde parou antes do deload."),
      note("", "Volume completo. Semana de consolidar cargas — mantenha a técnica limpa."),
    ]) {
      expect(isDeloadGuidance(no), no.notePt + no.setsNotePt).toBe(false);
    }
  });

});

describe("the week's RIR on each exercise", () => {
  // GD 1's wave; week 13 is the test week (its Mon–Wed deload).
  const wave = [3, 2.5, 2.5, 2, 1, 1, 2.5, 2.5, 2, 2, 1, 1, 3.5].map((rirTarget, i) => ({
    week: i + 1,
    rirTarget,
    notePt: "",
    setsNotePt: i === 12 ? "Seg-qua: deload — mesmas cargas." : "",
  }));
  const week = (n: number) => getWeekGuidance(wave, n);
  const baseline = baselineRir(wave);
  const bench = { freeWeightCompound: true, notes: "Use as travas; nunca à falha (mín. RIR 2).", timed: false };
  const machine = { freeWeightCompound: false, notes: null, timed: false };
  const hipThrust = { freeWeightCompound: true, notes: "Sem. 5-6 e 11-12: mín. RIR 1 (o leg press vem depois).", timed: false };

  it("the program's exercises are written at the middle of its wave (deload weeks aside)", () => {
    expect(baseline).toBe(2);
    expect(baselineRir([{ week: 1, rirTarget: 3 }, { week: 2, rirTarget: 1 }])).toBe(1);
    expect(baselineRir([])).toBeNull();
  });

  it("GD 1 week 5: each exercise moves with the wave — never the bench below its RIR 2 (the week's own note)", () => {
    expect(weekRirTarget(3, week(5), { baseline, exercise: bench })).toBe(2);
    expect(weekRirTarget(2.5, week(5), { baseline, exercise: machine })).toBe(1.5);
    // Isolations to RIR 1 — the last set to failure stays in the week's instructions.
    expect(weekRirTarget(2, week(5), { baseline, exercise: machine })).toBe(1);
    expect(weekRirTarget(2.5, week(5), { baseline, exercise: hipThrust })).toBe(2);
  });

  it("lighter weeks raise the targets, up to RIR 4", () => {
    expect(weekRirTarget(3, week(1), { baseline, exercise: bench })).toBe(4);
    expect(weekRirTarget(2, week(1), { baseline, exercise: machine })).toBe(3);
    expect(weekRirTarget(3, week(13), { baseline, exercise: bench })).toBe(4);
    expect(weekRirTarget(2.5, week(13), { baseline, exercise: machine })).toBe(4);
    // A program asking for more than 4 keeps it.
    expect(weekRirTarget(4.5, week(13), { baseline, exercise: machine })).toBe(4.5);
  });

  it("the middle weeks keep the program's own targets", () => {
    expect(weekRirTarget(3, week(4), { baseline, exercise: bench })).toBe(3);
    expect(weekRirTarget(2, week(9), { baseline, exercise: machine })).toBe(2);
  });

  it("holds, exercises without RIR and programs without a wave keep their own", () => {
    expect(weekRirTarget(1, week(1), { baseline, exercise: { ...machine, timed: true } })).toBe(1);
    expect(weekRirTarget(null, week(5), { baseline, exercise: machine })).toBeNull();
    expect(weekRirTarget(2.5, week(5), { baseline: null, exercise: machine })).toBe(2.5);
    expect(weekRirTarget(2.5, { rirTarget: null }, { baseline, exercise: machine })).toBe(2.5);
    expect(weekRirTarget(2.5, null)).toBe(2.5);
  });

  it("the floor: 1 for anything, 2 for free-weight compounds, the notes' minimum — never above the program's own", () => {
    expect(rirFloor(2, machine)).toBe(1);
    expect(rirFloor(3, bench)).toBe(2);
    expect(rirFloor(3, { ...machine, notes: "mín. RIR 2,5 nas últimas semanas" })).toBe(2.5);
    // The program itself asks for RIR 0 or 1: it gets it.
    expect(rirFloor(0, machine)).toBe(0);
    expect(rirFloor(1, bench)).toBe(1);
  });
});

describe("the program week the user is in", () => {
  // São Paulo is UTC−3: 15:00Z is midday there.
  const at = (iso: string) => new Date(`${iso}T15:00:00Z`);

  it("moves on with the first workout of a new calendar week", () => {
    expect(effectiveProgramWeek({ currentWeek: 4, sessionsThisWeek: 0, trainedBefore: true })).toBe(5);
    expect(effectiveProgramWeek({ currentWeek: 4, sessionsThisWeek: 2, trainedBefore: true })).toBe(4);
    expect(effectiveProgramWeek({ currentWeek: 1, sessionsThisWeek: 0, trainedBefore: false })).toBe(1);
  });

  it("days left this week, today included", () => {
    expect(daysLeftInWeek(at("2026-09-28"))).toBe(7); // Monday
    expect(daysLeftInWeek(at("2026-10-01"))).toBe(4); // Thursday
    expect(daysLeftInWeek(at("2026-10-04"))).toBe(1); // Sunday
  });

  it("a Thursday–Sunday start is an entry week while it lasts, then weeks count from the first full one", () => {
    const friday = at("2026-09-25");
    expect(programWeekView({ startedAt: friday, now: at("2026-09-27"), effectiveWeek: 1, entryWeekTrained: true })).toEqual({
      kind: "entry",
      daysLeft: 1,
      // The target's cap is set by the activation day (Friday → 3), not by today.
      cap: 3,
      guidanceWeek: 1,
    });
    // Monday after: the counter is at 2 (entry week trained) → program week 1.
    expect(programWeekView({ startedAt: friday, now: at("2026-09-28"), effectiveWeek: 2, entryWeekTrained: true })).toMatchObject({
      kind: "week",
      week: 1,
    });
    // An entry week with no workout never moved the counter.
    expect(programWeekView({ startedAt: friday, now: at("2026-09-28"), effectiveWeek: 1, entryWeekTrained: false })).toMatchObject({
      kind: "week",
      week: 1,
    });
    // A Monday–Wednesday start is week 1 right away.
    expect(
      programWeekView({ startedAt: at("2026-09-23"), now: at("2026-09-24"), effectiveWeek: 1, entryWeekTrained: false }),
    ).toMatchObject({ kind: "week", week: 1 });
  });

  it("the entry week's target: the plan's, capped at the days from the activation day to Sunday", () => {
    expect(entryWeekTarget(5, at("2026-09-24"))).toBe(4); // Thursday
    expect(entryWeekTarget(5, at("2026-09-27"))).toBe(1); // Sunday
    expect(entryWeekTarget(3, at("2026-09-24"))).toBe(3); // the plan asks for less
    expect(entryWeekTarget(0, at("2026-09-24"))).toBe(1);
  });

  it("this week's rule: the entry week's cap, and complete when the week already counts through another program", () => {
    const entry = programWeekView({ startedAt: at("2026-09-27"), now: at("2026-09-27"), effectiveWeek: 1, entryWeekTrained: false });
    const week = programWeekView({ startedAt: at("2026-09-21"), now: at("2026-09-27"), effectiveWeek: 1, entryWeekTrained: false });
    const met = { met: true, enrollmentId: "old" };
    expect(thisWeekRule({ view: entry, enrollmentId: "new", thisWeek: met })).toEqual({ targetCap: 1, alreadyCounts: true });
    // A deload week of the old block counts with any workout.
    expect(
      thisWeekRule({ view: entry, enrollmentId: "new", thisWeek: { met: false, deload: true, trained: true, enrollmentId: "old" } }),
    ).toEqual({ targetCap: 1, alreadyCounts: true });
    // Counted by this very program, or not counted: the entry week asks for its own days.
    expect(thisWeekRule({ view: entry, enrollmentId: "new", thisWeek: { met: true, enrollmentId: "new" } }).alreadyCounts).toBe(false);
    expect(thisWeekRule({ view: entry, enrollmentId: "new", thisWeek: { met: false, trained: true, enrollmentId: "old" } }).alreadyCounts).toBe(false);
    // Outside an entry week there's no cap, whatever the week.
    expect(thisWeekRule({ view: week, enrollmentId: "new", thisWeek: met })).toEqual({ targetCap: null, alreadyCounts: false });
    expect(thisWeekRule({ view: null, enrollmentId: "new", thisWeek: met })).toEqual({ targetCap: null, alreadyCounts: false });
  });

  it("a complete week's input marks every trainable day done", () => {
    const done = completeWeekDone(["a", "b"]);
    expect([...done.doneDayIds]).toEqual(["a", "b"]);
    expect(done.sessionCount).toBeGreaterThan(100);
  });
});
