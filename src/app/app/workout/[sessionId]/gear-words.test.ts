import { describe, expect, it } from "vitest";
import { DEFAULT_GYM_LOADS, loadGridFor } from "@/lib/training/load-grid";
import { hasLoadSteps, lackedList } from "./gear-words";

describe("lackedList", () => {
  it("joins what the gym lacks the way a sentence does", () => {
    expect(lackedList([])).toBe("");
    expect(lackedList(["Hack"])).toBe("Hack");
    expect(lackedList(["Remada baixa", "Crossover / polia"])).toBe("Remada baixa nem Crossover / polia");
    expect(lackedList(["Halteres", "Barra W", "Smith"])).toBe("Halteres, Barra W nem Smith");
  });
});

describe("hasLoadSteps", () => {
  const gym = DEFAULT_GYM_LOADS;
  const ex = (kind: Parameters<typeof loadGridFor>[0], extra: { bodyweight?: boolean; timed?: boolean } = {}) => ({
    bodyweight: extra.bodyweight ?? false,
    timed: extra.timed ?? false,
    loadGrid: loadGridFor(kind, gym),
  });

  it("is for loads that move in kg: stacks, cables, plates, racks", () => {
    expect(hasLoadSteps(ex("CABLE"))).toBe(true);
    expect(hasLoadSteps(ex("STACK"))).toBe(true);
    expect(hasLoadSteps(ex("PLATE_MACHINE"))).toBe(true);
    expect(hasLoadSteps(ex("DUMBBELL"))).toBe(true);
  });

  it("not for the body's own weight, a hold in seconds, or what never moves in kg", () => {
    expect(hasLoadSteps(ex("BODYWEIGHT"))).toBe(false);
    expect(hasLoadSteps(ex("CABLE", { bodyweight: true }))).toBe(false);
    expect(hasLoadSteps(ex("PLATE_ONE_SIDE", { timed: true }))).toBe(false);
    expect(hasLoadSteps(ex("NONE"))).toBe(false);
  });
});
