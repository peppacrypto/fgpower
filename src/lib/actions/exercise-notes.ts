"use server";

import { requireUserOrThrow } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { EXERCISE_NOTE_MAX } from "@/lib/validation/program-builder";

export async function saveExerciseNote(exerciseId: string, note: string) {
  const user = await requireUserOrThrow();
  // Server actions are public POST endpoints: never trust the payload's shape or size.
  const id = typeof exerciseId === "string" ? exerciseId : "";
  const trimmed = (typeof note === "string" ? note : "").trim();
  if (!id || !trimmed) {
    await prisma.exerciseUserNote.deleteMany({ where: { userId: user.id, exerciseId: id } });
    return;
  }
  // Cap at the same bound the builder enforces: one account could otherwise
  // store ~1 MB per exercise across 876 exercises and fill the volume (A-003).
  const capped = trimmed.slice(0, EXERCISE_NOTE_MAX);
  await prisma.exerciseUserNote.upsert({
    where: { userId_exerciseId: { userId: user.id, exerciseId: id } },
    create: { userId: user.id, exerciseId: id, note: capped },
    update: { note: capped },
  });
}
