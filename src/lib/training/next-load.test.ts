import { describe, expect, it } from "vitest";
import { adviseNextLoad } from "./next-load";

const S = " ";
const prescribed = { repMin: 8, repMax: 12, rirTarget: 2 };
const sets = (w: number, reps: number[], rir: number | null = 2) => reps.map((r) => ({ weightKg: w, reps: r, rir }));

describe("adviseNextLoad", () => {
  it("suggests the next load once every set reached the top of the range", () => {
    const a = adviseNextLoad({ strategy: "DOUBLE", prescribed, sets: sets(60, [12, 12, 12]), loadIncrementKg: 2.5 });
    expect(a).toMatchObject({ kind: "increase", loadKg: 62.5, targetReps: 8 });
    expect(a?.headline).toBe(`↑ Suba para 62,5${S}kg`);
    expect(a?.reason).toBe("12 reps em todas as séries com RIR ≥ 2");
  });

  it("holds the load and asks for one more rep inside the range", () => {
    const a = adviseNextLoad({ strategy: "DOUBLE", prescribed, sets: sets(60, [10, 9, 9]), loadIncrementKg: 2.5 });
    expect(a).toMatchObject({ kind: "hold", loadKg: 60, targetReps: 10 });
    expect(a?.headline).toBe(`Mantenha 60${S}kg · busque 10 reps`);
  });

  it("asks to complete the range when a set fell short", () => {
    const a = adviseNextLoad({ strategy: "DOUBLE", prescribed, sets: sets(60, [8, 7, 6]), loadIncrementKg: 2.5 });
    expect(a).toMatchObject({ kind: "hold", loadKg: 60, targetReps: 8 });
  });

  it("defaults to double progression and to a 2,5 kg step", () => {
    const a = adviseNextLoad({ strategy: null, prescribed, sets: sets(40, [12, 12]), loadIncrementKg: 0 });
    expect(a?.loadKg).toBe(42.5);
  });

  it("doesn't mention RIR when it wasn't logged", () => {
    const a = adviseNextLoad({ strategy: "DOUBLE", prescribed, sets: sets(60, [12, 12, 12], null), loadIncrementKg: 2.5 });
    expect(a?.reason).toBe("12 reps em todas as séries");
  });

  it("goes exactly one step up, not to the next 2,5 kg mark", () => {
    const a = adviseNextLoad({ strategy: "DOUBLE", prescribed, sets: sets(12, [12, 12, 12]), loadIncrementKg: 2.5 });
    expect(a?.loadKg).toBe(14.5);
  });

  it("holds when a set at the top of the range was done with a lighter load", () => {
    const a = adviseNextLoad({
      strategy: "DOUBLE",
      prescribed,
      sets: [...sets(12, [12, 12]), { weightKg: 10, reps: 12, rir: 2 }],
      loadIncrementKg: 2.5,
    });
    expect(a).toMatchObject({ kind: "hold", loadKg: 12 });
    expect(a?.headline).toBe(`Mantenha 12${S}kg · todas as séries com essa carga`);
  });

  it("holds and names RIR as the blocker when reps hit the top but the effort was too close to failure", () => {
    const a = adviseNextLoad({ strategy: "DOUBLE", prescribed: { repMin: 6, repMax: 8, rirTarget: 2 }, sets: sets(50, [8, 8], 1), loadIncrementKg: 2.5 });
    expect(a).toMatchObject({ kind: "hold", loadKg: 50, targetReps: 8 });
    expect(a?.headline).toBe(`Mantenha 50${S}kg · 8 reps com RIR 2`);
    expect(a?.reason).toContain("mas com RIR 1 (alvo 2)");
  });

  it("says nothing without a load or with a manual strategy", () => {
    expect(adviseNextLoad({ strategy: "DOUBLE", prescribed, sets: [], loadIncrementKg: 2.5 })).toBeNull();
    expect(adviseNextLoad({ strategy: "DOUBLE", prescribed, sets: sets(0, [15, 15]), loadIncrementKg: 2.5 })).toBeNull();
    expect(adviseNextLoad({ strategy: "MANUAL", prescribed, sets: sets(60, [12, 12]), loadIncrementKg: 2.5 })).toBeNull();
  });
});
