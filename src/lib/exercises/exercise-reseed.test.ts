import { describe, expect, it } from "vitest";
import { exerciseReseedUpdate, type GeneratedExerciseFields } from "./exercise-reseed";

const generated: GeneratedExerciseFields = {
  nameEn: "Catalog Name",
  namePt: "Nome Catálogo",
  category: "STRENGTH",
  movementPattern: "horizontal-push",
  equipment: "barbell",
  difficulty: "BEGINNER",
  forceType: "PUSH",
  laterality: "BILATERAL",
  mechanics: "COMPOUND",
  instructionsEn: ["step a"],
  instructionsPt: ["passo a"],
};

describe("exerciseReseedUpdate", () => {
  it("rewrites names and searchText for a row no admin has touched", () => {
    const update = exerciseReseedUpdate(generated, "catalog name nome catalogo", false);
    expect(update).toMatchObject({
      nameEn: "Catalog Name",
      namePt: "Nome Catálogo",
      searchText: "catalog name nome catalogo",
      equipmentId: "barbell",
      instructionsPt: ["passo a"],
    });
  });

  it("omits the admin-owned name and searchText when the row is admin-edited", () => {
    const update = exerciseReseedUpdate(generated, "catalog name nome catalogo", true);
    expect(update).not.toHaveProperty("nameEn");
    expect(update).not.toHaveProperty("namePt");
    expect(update).not.toHaveProperty("searchText");
    // taxonomy, instructions and media still track the catalog
    expect(update).toMatchObject({ equipmentId: "barbell", difficulty: "BEGINNER" });
    expect(update.instructionsPt).toEqual(["passo a"]);
  });
});
