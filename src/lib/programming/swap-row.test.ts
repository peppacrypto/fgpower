import { describe, expect, it } from "vitest";
import { swapRowExercise } from "./swap-row";
import type { BuilderExercise } from "@/lib/actions/program-builder";

type Row = BuilderExercise & { rowId: string };

const row: Row = {
  rowId: "r1",
  id: "db1",
  exerciseId: "old-ex",
  exerciseName: "Supino",
  groupKey: "A",
  sets: 4,
  repMin: 8,
  repMax: 12,
  rirTarget: 2,
  restSeconds: 120,
  warmupSets: 1,
  loadTargetKg: 50,
  notes: "lembrar o banco",
};

const picked = { id: "new-ex", namePt: "Agachamento", mechanics: "COMPOUND" as const, slug: "agachamento" };

describe("swapRowExercise (A-077)", () => {
  it("same timed-ness keeps the prescription, order, group and ids; swaps only the exercise", () => {
    const out = swapRowExercise(row, picked, { oldTimed: false, newTimed: false });
    expect(out.exerciseId).toBe("new-ex");
    expect(out.exerciseName).toBe("Agachamento");
    // Prescription and carried fields untouched.
    expect(out.repMin).toBe(8);
    expect(out.repMax).toBe(12);
    expect(out.sets).toBe(4);
    expect(out.rirTarget).toBe(2);
    expect(out.warmupSets).toBe(1);
    expect(out.restSeconds).toBe(120);
    expect(out.groupKey).toBe("A");
    expect(out.loadTargetKg).toBe(50);
    expect(out.notes).toBe("lembrar o banco");
    expect(out.id).toBe("db1");
    expect(out.rowId).toBe("r1");
  });

  it("across a timed↔untimed change swaps the rep range for the new exercise's default (A-058)", () => {
    const out = swapRowExercise(row, picked, { oldTimed: false, newTimed: true });
    // defaultPrescription("COMPOUND") → repMin 6, repMax 10; everything else kept.
    expect(out.repMin).toBe(6);
    expect(out.repMax).toBe(10);
    expect(out.sets).toBe(4);
    expect(out.rirTarget).toBe(2);
    expect(out.restSeconds).toBe(120);
    expect(out.groupKey).toBe("A");
    expect(out.id).toBe("db1");
    expect(out.rowId).toBe("r1");
    expect(out.exerciseId).toBe("new-ex");
  });
});
