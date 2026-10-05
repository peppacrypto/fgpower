import type { Prisma } from "@/generated/prisma/client";

/** The subset of the generated catalog entry the reseed writes to an existing row. */
export interface GeneratedExerciseFields {
  nameEn: string;
  namePt: string;
  category: string;
  movementPattern: string | null;
  equipment: string;
  difficulty: string;
  forceType: string;
  laterality: string;
  mechanics: string;
  instructionsEn: string[];
  instructionsPt: string[];
}

/**
 * The `update` clause of the exercise upsert in prisma/seed.ts.
 *
 * Taxonomy, instructions and media always track the catalog. The admin-owned
 * name fields and their derived `searchText` track the catalog too — EXCEPT on
 * a row an admin has edited (`adminEditedAt` set), where they are left out so a
 * post-deploy reseed never reverts the owner's correction (A-040).
 */
export function exerciseReseedUpdate(
  ex: GeneratedExerciseFields,
  searchText: string,
  adminEdited: boolean,
): Prisma.ExerciseUncheckedUpdateInput {
  return {
    category: ex.category as never,
    movementPatternId: ex.movementPattern,
    equipmentId: ex.equipment,
    difficulty: ex.difficulty as never,
    forceType: ex.forceType as never,
    laterality: ex.laterality as never,
    mechanics: ex.mechanics as never,
    instructionsEn: ex.instructionsEn,
    instructionsPt: ex.instructionsPt,
    ...(adminEdited ? {} : { nameEn: ex.nameEn, namePt: ex.namePt, searchText }),
  };
}
