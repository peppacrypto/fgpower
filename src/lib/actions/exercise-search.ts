"use server";

import { listExercises } from "@/lib/data/exercises";

export async function searchExercisesForPicker(query: string) {
  const { items } = await listExercises({ q: query, pageSize: 20 });
  return items.map((e) => ({
    id: e.id,
    namePt: e.namePt,
    imageUrl: e.media[0]?.url ?? null,
    primaryMuscle: e.muscles[0]?.muscle.namePt ?? null,
    equipment: e.equipment?.namePt ?? null,
  }));
}
