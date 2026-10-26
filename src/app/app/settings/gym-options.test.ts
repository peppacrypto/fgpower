import { describe, expect, it } from "vitest";
import { DEFAULT_GYM_LOADS, DUMBBELL_SCHEMES, type GymLoadSettings } from "@/lib/training/load-grid";
import { DUMBBELL_SCHEME_LABEL, gymExamples, gymLoadsForForm, kgChip, missingCountText, stepExample, withGear } from "./gym-options";

/** formatKg puts a non-breaking space before "kg" (it never wraps away from its number). */
const nb = (s: string) => s.replace(/ kg/g, " kg");
const gym = (patch: Partial<GymLoadSettings> = {}): GymLoadSettings => ({ ...DEFAULT_GYM_LOADS, ...patch });

describe("Minha academia → Pesos: the words and the examples", () => {
  it("names every rack spacing the server takes", () => {
    expect(Object.keys(DUMBBELL_SCHEME_LABEL).sort()).toEqual([...DUMBBELL_SCHEMES].sort());
    expect(DUMBBELL_SCHEME_LABEL["1-10-2"]).toBe("1 em 1 até 10 kg, depois 2 em 2");
    expect(DUMBBELL_SCHEME_LABEL["2.5"]).toBe("2,5 em 2,5");
  });

  it("shows the most common gym's jumps by default — the mixed rack on both sides of 10 kg", () => {
    expect(gymExamples(gym())).toEqual({
      dumbbellScheme: nb("Ex.: 8 → 9 kg; 12 → 14 kg."),
      stackStepKg: nb("Ex.: 40 → 45 kg."),
      cableStepKg: nb("Ex.: 20 → 25 kg."),
      smallestPlateKg: nb("Ex.: barra 60 → 65 kg; cavalinho 30 → 32,5 kg."),
      kettlebellStepKg: nb("Ex.: 12 → 16 kg."),
    });
  });

  it("follows each choice, starting from a load that exists on that grid", () => {
    expect(gymExamples(gym({ dumbbellScheme: "1" })).dumbbellScheme).toBe(nb("Ex.: 12 → 13 kg."));
    expect(gymExamples(gym({ dumbbellScheme: "2" })).dumbbellScheme).toBe(nb("Ex.: 12 → 14 kg."));
    // 12 isn't a dumbbell on a 2,5 kg rack: the example starts from one that is.
    expect(gymExamples(gym({ dumbbellScheme: "2.5" })).dumbbellScheme).toBe(nb("Ex.: 12,5 → 15 kg."));
    expect(gymExamples(gym({ stackStepKg: 7.5 })).stackStepKg).toBe(nb("Ex.: 40 → 47,5 kg."));
    expect(gymExamples(gym({ cableStepKg: 2.5 })).cableStepKg).toBe(nb("Ex.: 20 → 22,5 kg."));
    // A pair of the lightest plates on a bar, one on a T-bar.
    expect(gymExamples(gym({ smallestPlateKg: 1.25 })).smallestPlateKg).toBe(nb("Ex.: barra 60 → 62,5 kg; cavalinho 30 → 31,25 kg."));
    expect(gymExamples(gym({ kettlebellStepKg: 2 })).kettlebellStepKg).toBe(nb("Ex.: 12 → 14 kg."));
  });

  it("says nothing for a load that never moves in kg", () => {
    expect(stepExample("NONE", gym(), 10)).toBe("");
  });

  it("reads a chip's kilos the pt-BR way: singular below 2", () => {
    expect(kgChip(2.5)).toEqual({ value: 2.5, label: "2,5", srLabel: "2,5 quilos" });
    expect(kgChip(1.25)).toEqual({ value: 1.25, label: "1,25", srLabel: "1,25 quilo" });
    expect(kgChip(10).srLabel).toBe("10 quilos");
  });
});

describe("gymLoadsForForm", () => {
  it("keeps offered values as they are", () => {
    const mine = gym({ dumbbellScheme: "2", stackStepKg: 10, cableStepKg: 2.5, smallestPlateKg: 0.5, kettlebellStepKg: 2 });
    expect(gymLoadsForForm(mine)).toEqual(mine);
  });

  it("reads a value no chip offers as the default gym's, one field at a time", () => {
    expect(
      gymLoadsForForm({ dumbbellScheme: "3" as GymLoadSettings["dumbbellScheme"], stackStepKg: 3, cableStepKg: 2.5, smallestPlateKg: 0.75, kettlebellStepKg: 8 }),
    ).toEqual({ ...DEFAULT_GYM_LOADS, cableStepKg: 2.5 });
  });
});

describe("Minha academia → Aparelhos", () => {
  const order = ["dumbbells", "barbell", "hack-squat", "smith", "treadmill"];

  it("adds what the gym lacks and takes back what it has, in the checklist's order, once", () => {
    expect(withGear([], ["smith"], false, order)).toEqual(["smith"]);
    expect(withGear(["smith"], ["hack-squat"], false, order)).toEqual(["hack-squat", "smith"]);
    expect(withGear(["hack-squat", "smith"], ["smith"], true, order)).toEqual(["hack-squat"]);
    expect(withGear(["smith"], ["smith", "smith"], false, order)).toEqual(["smith"]);
  });

  it("marks or clears a whole group in one go", () => {
    expect(withGear(["treadmill"], ["hack-squat", "smith"], false, order)).toEqual(["hack-squat", "smith", "treadmill"]);
    expect(withGear(["hack-squat", "smith", "treadmill"], ["hack-squat", "smith"], true, order)).toEqual(["treadmill"]);
  });

  it("drops what the checklist doesn't list, as the server does", () => {
    expect(withGear(["other-machine", "smith"], ["nope"], false, order)).toEqual(["smith"]);
  });

  it("counts what's missing in words", () => {
    expect(missingCountText(0)).toBe("Tem todos");
    expect(missingCountText(1)).toBe("Falta 1");
    expect(missingCountText(12)).toBe("Faltam 12");
  });
});
