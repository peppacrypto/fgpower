import { describe, expect, it } from "vitest";
import { additiveGrid } from "@/lib/training/load-grid";
import { adviseNextLoad } from "./next-load";
import { DEFAULT_GYM_LOADS, extendedRepCap, loadGridFor } from "./load-grid";

const S = " ";
const prescribed = { repMin: 8, repMax: 12, rirTarget: 2 };
const sets = (w: number, reps: number[], rir: number | null = 2) => reps.map((r) => ({ weightKg: w, reps: r, rir }));

describe("adviseNextLoad", () => {
  it("suggests the next load once every set reached the top of the range", () => {
    const a = adviseNextLoad({ strategy: "DOUBLE", prescribed, sets: sets(60, [12, 12, 12]), grid: additiveGrid(2.5) });
    expect(a).toMatchObject({ kind: "increase", loadKg: 62.5, targetReps: 8 });
    expect(a?.headline).toBe(`↑ Suba para 62,5${S}kg`);
    expect(a?.reason).toBe("12 reps em todas as séries com RIR ≥ 2");
  });

  it("holds the load and asks for one more rep inside the range", () => {
    const a = adviseNextLoad({ strategy: "DOUBLE", prescribed, sets: sets(60, [10, 9, 9]), grid: additiveGrid(2.5) });
    expect(a).toMatchObject({ kind: "hold", loadKg: 60, targetReps: 10 });
    expect(a?.headline).toBe(`Mantenha 60${S}kg · busque 10 reps`);
  });

  it("asks to complete the range when one set fell short", () => {
    const a = adviseNextLoad({ strategy: "DOUBLE", prescribed, sets: sets(60, [9, 8, 7]), grid: additiveGrid(2.5) });
    expect(a).toMatchObject({ kind: "hold", loadKg: 60, targetReps: 8 });
    expect(a?.headline).toBe(`Mantenha 60${S}kg · complete 8 reps`);
  });

  it("steps back one load when most sets fell below the range (P18)", () => {
    const a = adviseNextLoad({ strategy: "DOUBLE", prescribed, sets: sets(60, [8, 7, 6]), grid: additiveGrid(2.5) });
    expect(a).toMatchObject({ kind: "decrease", loadKg: 57.5 });
    expect(a?.headline).toMatch(new RegExp(`^↓ Volte para 57,5${S}kg · busque \\d+ reps$`));
    expect(a?.reason).toBe(`2 de 3 séries abaixo de 8 reps com 60${S}kg: um degrau abaixo e mais reps antes de subir de novo`);
  });

  it("defaults to double progression and to a 2,5 kg step", () => {
    const a = adviseNextLoad({ strategy: null, prescribed, sets: sets(40, [12, 12]), grid: additiveGrid(0) });
    expect(a?.loadKg).toBe(42.5);
  });

  it("doesn't mention RIR when it wasn't logged", () => {
    const a = adviseNextLoad({ strategy: "DOUBLE", prescribed, sets: sets(60, [12, 12, 12], null), grid: additiveGrid(2.5) });
    expect(a?.reason).toBe("12 reps em todas as séries");
  });

  it("goes exactly one step up from an off-grid load (40,5 → 43)", () => {
    const a = adviseNextLoad({ strategy: "DOUBLE", prescribed, sets: sets(40.5, [12, 12, 12]), grid: additiveGrid(2.5) });
    expect(a?.loadKg).toBe(43);
  });

  it("holds when a set at the top of the range was done with a lighter load", () => {
    const a = adviseNextLoad({
      strategy: "DOUBLE",
      prescribed,
      sets: [...sets(12, [12, 12]), { weightKg: 10, reps: 12, rir: 2 }],
      grid: additiveGrid(2.5),
    });
    expect(a).toMatchObject({ kind: "hold", loadKg: 12 });
    expect(a?.headline).toBe(`Mantenha 12${S}kg · todas as séries com essa carga`);
  });

  it("holds and names RIR as the blocker when reps hit the top but the effort was too close to failure", () => {
    const a = adviseNextLoad({ strategy: "DOUBLE", prescribed: { repMin: 6, repMax: 8, rirTarget: 2 }, sets: sets(50, [8, 8], 1), grid: additiveGrid(2.5) });
    expect(a).toMatchObject({ kind: "hold", loadKg: 50, targetReps: 8 });
    expect(a?.headline).toBe(`Mantenha 50${S}kg · 8 reps com RIR 2`);
    expect(a?.reason).toContain("mas com RIR 1 (alvo 2)");
  });

  it("says nothing without a load or with a manual strategy", () => {
    expect(adviseNextLoad({ strategy: "DOUBLE", prescribed, sets: [], grid: additiveGrid(2.5) })).toBeNull();
    expect(adviseNextLoad({ strategy: "DOUBLE", prescribed, sets: sets(0, [15, 15]), grid: additiveGrid(2.5) })).toBeNull();
    expect(adviseNextLoad({ strategy: "MANUAL", prescribed, sets: sets(60, [12, 12]), grid: additiveGrid(2.5) })).toBeNull();
  });

  it("an RIR-based hold explains the RIR gate, not a rep target (A-055)", () => {
    // avg RIR == target → rir-at-target-keep-load.
    const a = adviseNextLoad({
      strategy: "RIR_BASED",
      prescribed: { repMin: 5, repMax: 8, rirTarget: 2 },
      sets: [
        { weightKg: 100, reps: 8, rir: 2 },
        { weightKg: 100, reps: 8, rir: 2 },
        { weightKg: 100, reps: 8, rir: 2 },
        { weightKg: 100, reps: 8, rir: 2 },
      ],
      grid: additiveGrid(2.5),
    });
    expect(a?.kind).toBe("hold");
    expect(a?.reason).toBe("Suba a carga quando sobrar RIR 3+ em média (alvo 2)");
    expect(a?.reason).not.toContain("reps em todas");
  });

  it("a double-progression hold still asks for the rep ceiling (A-055 unchanged)", () => {
    const a = adviseNextLoad({
      strategy: "DOUBLE",
      prescribed: { repMin: 8, repMax: 12, rirTarget: 2 },
      sets: [
        { weightKg: 60, reps: 10, rir: 2 },
        { weightKg: 60, reps: 9, rir: 2 },
      ],
      grid: additiveGrid(2.5),
    });
    expect(a?.reason).toBe("Suba a carga quando fizer 12 reps em todas");
  });

  it("a LINEAR_LOAD uneven session routes to the uneven-loads advice (A-055)", () => {
    const a = adviseNextLoad({
      strategy: "LINEAR_LOAD",
      prescribed: { repMin: 5, repMax: 5, rirTarget: 2 },
      sets: [
        { weightKg: 100, reps: 5, rir: 2 },
        { weightKg: 100, reps: 5, rir: 2 },
        { weightKg: 97.5, reps: 5, rir: 2 },
      ],
      grid: additiveGrid(2.5),
    });
    expect(a?.kind).toBe("hold");
    expect(a?.reason).toContain("todas as séries com");
    expect(a?.reason).not.toContain("abaixo de");
  });
});

describe("adviseNextLoad on the gym's real loads (load-grid, P18)", () => {
  const gym = DEFAULT_GYM_LOADS;
  const dumbbells = loadGridFor("DUMBBELL", gym);
  const stack = loadGridFor("STACK", gym);
  const cable = loadGridFor("CABLE", gym);
  const bar = loadGridFor("BARBELL", gym);

  it("goes to the next dumbbell on the rack, never to a dumbbell that doesn't exist", () => {
    // 20 → 22 is +10%: 10 reps at RIR 2 still give ~6 at 22 kg, inside 6–10.
    const a = adviseNextLoad({ strategy: "DOUBLE", prescribed: { repMin: 6, repMax: 10, rirTarget: 2 }, sets: sets(20, [10, 10, 10]), grid: dumbbells });
    expect(a).toMatchObject({ kind: "increase", loadKg: 22 });
    // Under 10 kg the rack goes 1 kg at a time.
    const b = adviseNextLoad({ strategy: "DOUBLE", prescribed: { repMin: 6, repMax: 10, rirTarget: 2 }, sets: sets(9, [10, 10]), grid: dumbbells });
    expect(b?.loadKg).toBe(10);
  });

  it("asks for more reps first when the next dumbbell is too big a jump for the range", () => {
    // 12 → 14 kg is +16,7%: from 12 reps at RIR 2 that's ~6 reps — below 8.
    const a = adviseNextLoad({ strategy: "DOUBLE", prescribed, sets: sets(12, [12, 12, 12]), grid: dumbbells });
    expect(a).toMatchObject({ kind: "hold", loadKg: 12, targetReps: 15 });
    expect(a?.headline).toBe(`Mantenha 12${S}kg · busque 15 reps`);
    expect(a?.reason).toBe(`O próximo peso, 14${S}kg, é um salto de +16,7%: com 15 reps aqui você chega a 8+ lá`);
    // Once there, it goes up.
    const b = adviseNextLoad({ strategy: "DOUBLE", prescribed, sets: sets(12, [15, 15, 15]), grid: dumbbells });
    expect(b).toMatchObject({ kind: "increase", loadKg: 14, targetReps: 8 });
  });

  it("says, inside the range, how many reps unlock a coarse jump", () => {
    const a = adviseNextLoad({ strategy: "DOUBLE", prescribed, sets: sets(12, [10, 10, 9]), grid: dumbbells });
    expect(a).toMatchObject({ kind: "hold", loadKg: 12, targetReps: 10 });
    expect(a?.reason).toBe(`Suba para 14${S}kg quando fizer 15 reps em todas (salto de +16,7%)`);
    // A jump that fits keeps the plain wording (A-055).
    const b = adviseNextLoad({ strategy: "DOUBLE", prescribed, sets: sets(60, [10, 9, 9]), grid: bar });
    expect(b?.reason).toBe("Suba a carga quando fizer 12 reps em todas");
  });

  it("moves a pin-loaded machine one plate of its stack at a time", () => {
    const a = adviseNextLoad({ strategy: "DOUBLE", prescribed, sets: sets(60, [12, 12, 12]), grid: stack });
    expect(a).toMatchObject({ kind: "increase", loadKg: 65 });
    // A plate is +12,5% at 40 kg: one rep past the range first, then the plate.
    const b = adviseNextLoad({ strategy: "DOUBLE", prescribed, sets: sets(40, [12, 12, 12]), grid: stack });
    expect(b).toMatchObject({ kind: "hold", loadKg: 40, targetReps: 13 });
    const c = adviseNextLoad({ strategy: "DOUBLE", prescribed, sets: sets(40, [13, 13, 13]), grid: stack });
    expect(c).toMatchObject({ kind: "increase", loadKg: 45, targetReps: 8 });
  });

  it("stretches a lateral raise toward 30 reps before doubling a 5 kg cable stack, then jumps", () => {
    const lateral = { repMin: 12, repMax: 15, rirTarget: 2 };
    const cap = extendedRepCap(15, "shoulder-abduction");
    expect(cap).toBe(30);
    const a = adviseNextLoad({ strategy: "DOUBLE", prescribed: lateral, sets: sets(5, [15, 15, 15]), grid: cable, repCap: cap });
    expect(a).toMatchObject({ kind: "hold", loadKg: 5, targetReps: 30 });
    expect(a?.reason).toBe(`O próximo peso, 10${S}kg, é um salto de +100%: estenda a faixa até 30 reps antes de subir`);
    const b = adviseNextLoad({ strategy: "DOUBLE", prescribed: lateral, sets: sets(5, [30, 30, 30]), grid: cable, repCap: cap });
    expect(b).toMatchObject({ kind: "increase", loadKg: 10 });
    expect(b?.reason).toBe(`Salto grande (+100%): se as reps caírem abaixo de 12, volte para 5${S}kg`);
  });

  it("brings a jump that broke the range back one plate (voador 40 → 50)", () => {
    const fly = { repMin: 10, repMax: 12, rirTarget: 2 };
    const a = adviseNextLoad({ strategy: "DOUBLE", prescribed: fly, sets: sets(50, [9, 8, 7]), grid: stack });
    expect(a).toMatchObject({ kind: "decrease", loadKg: 45 });
    expect(a?.targetReps).toBeGreaterThanOrEqual(10);
    expect(a?.targetReps).toBeLessThanOrEqual(12);
  });

  it("puts a pair of the smallest plates on a bar", () => {
    const a = adviseNextLoad({ strategy: "DOUBLE", prescribed, sets: sets(60, [12, 12, 12]), grid: bar });
    expect(a?.loadKg).toBe(65);
    const fine = loadGridFor("BARBELL", { ...gym, smallestPlateKg: 1 });
    expect(adviseNextLoad({ strategy: "DOUBLE", prescribed, sets: sets(60, [12, 12, 12]), grid: fine })?.loadKg).toBe(62);
  });

  it("an exercise's own step wins over the gym's", () => {
    const own = loadGridFor("STACK", gym, { stepKg: 10, source: "exercise" });
    const a = adviseNextLoad({ strategy: "DOUBLE", prescribed: { repMin: 8, repMax: 15, rirTarget: 2 }, sets: sets(80, [15, 15]), grid: own });
    expect(a?.loadKg).toBe(90);
  });

  it("never suggests a load on equipment that doesn't move in kg — more reps instead", () => {
    const none = loadGridFor("NONE", gym);
    const a = adviseNextLoad({ strategy: "DOUBLE", prescribed, sets: sets(10, [12, 12]), grid: none });
    expect(a).toMatchObject({ kind: "hold", loadKg: 10, targetReps: 13 });
  });

  it("linear and RIR-based progressions also move along the grid, without stretching the range", () => {
    const a = adviseNextLoad({
      strategy: "LINEAR_LOAD",
      prescribed: { repMin: 5, repMax: 5, rirTarget: 2 },
      sets: sets(12, [5, 5, 5]),
      grid: dumbbells,
    });
    expect(a).toMatchObject({ kind: "increase", loadKg: 14 });
    const b = adviseNextLoad({
      strategy: "RIR_BASED",
      prescribed: { repMin: 6, repMax: 8, rirTarget: 2 },
      sets: sets(9, [8, 8], 4),
      grid: dumbbells,
    });
    expect(b).toMatchObject({ kind: "increase", loadKg: 10 });
  });
});

describe("adviseNextLoad with extra load on the body's own weight", () => {
  it("adds one plate to the belt without stretching the range (the body is most of the load)", () => {
    const belt = loadGridFor("BODYWEIGHT", DEFAULT_GYM_LOADS);
    const a = adviseNextLoad({ strategy: "DOUBLE", prescribed: { repMin: 6, repMax: 10, rirTarget: 2 }, sets: sets(10, [10, 10, 10]), grid: belt });
    expect(a).toMatchObject({ kind: "increase", loadKg: 12.5 });
  });
});
