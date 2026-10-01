import { describe, expect, it } from "vitest";
import { muscleRowLabel } from "./muscle-volume-bars";

/** "Séries por músculo"'s rows as a screen reader says them (each row's group name). */
describe("muscleRowLabel", () => {
  it("counts with the right word, and its state", () => {
    expect(muscleRowLabel({ label: "Peitoral", sets: 11, status: "ok" })).toBe("Peitoral: 11 séries por semana, na faixa");
    expect(muscleRowLabel({ label: "Bíceps", sets: 1, status: "low" })).toBe("Bíceps: 1 série por semana, abaixo");
    expect(muscleRowLabel({ label: "Ombros", sets: 21.5, status: "high" })).toBe("Ombros: 21,5 séries por semana, acima");
  });

  it("says an untrained group once, not 'nenhuma série, sem séries'", () => {
    expect(muscleRowLabel({ label: "Costas", sets: 0, status: "none" })).toBe("Costas: nenhuma série");
  });
});
