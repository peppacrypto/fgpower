"use server";

import { requireUserOrThrow } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";

export async function saveExerciseNote(exerciseId: string, note: string) {
  const user = await requireUserOrThrow();
  if (!note.trim()) {
    await prisma.exerciseUserNote.deleteMany({ where: { userId: user.id, exerciseId } });
    return;
  }
  await prisma.exerciseUserNote.upsert({
    where: { userId_exerciseId: { userId: user.id, exerciseId } },
    create: { userId: user.id, exerciseId, note: note.trim() },
    update: { note: note.trim() },
  });
}
