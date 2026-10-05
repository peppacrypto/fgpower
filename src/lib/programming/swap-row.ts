import { defaultPrescription } from "@/lib/validation/program-builder-constants";
import type { BuilderExercise } from "@/lib/actions/program-builder";

/**
 * Replace a builder row's exercise in place, keeping the prescription, order,
 * group and DB id (A-077). Across a timed↔untimed change, do NOT carry the rep
 * range — use the new exercise's default (A-058: an 8–12 rep range must not
 * become an 8–12 s hold). Generic so the caller's row type (which carries a
 * client-only rowId) is preserved.
 *
 * Lives here rather than in the `"use server"` program-builder action module:
 * that module may only export async functions, and this sync pure helper also
 * has to be callable synchronously on the client (the builder maps rows with it).
 */
export function swapRowExercise<T extends BuilderExercise>(
  row: T,
  picked: { id: string; namePt: string; mechanics: string | null; slug: string },
  opts: { oldTimed: boolean; newTimed: boolean },
): T {
  const base: T = { ...row, exerciseId: picked.id, exerciseName: picked.namePt };
  if (opts.oldTimed !== opts.newTimed) {
    const def = defaultPrescription(picked.mechanics);
    return { ...base, repMin: def.repMin, repMax: def.repMax };
  }
  return base;
}
