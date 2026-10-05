"use server";

import { requireUserOrThrow } from "@/lib/auth/require-user";
import { persistExerciseNote } from "@/lib/data/exercise-notes";

export async function saveExerciseNote(exerciseId: string, note: string) {
  const user = await requireUserOrThrow();
  await persistExerciseNote(user.id, exerciseId, note);
}
