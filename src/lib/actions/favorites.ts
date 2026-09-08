"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";

export async function toggleFavoriteExercise(exerciseId: string): Promise<{ favorited: boolean }> {
  const user = await requireUserOrThrow();

  const existing = await prisma.favoriteExercise.findUnique({
    where: { userId_exerciseId: { userId: user.id, exerciseId } },
  });

  if (existing) {
    await prisma.favoriteExercise.delete({ where: { userId_exerciseId: { userId: user.id, exerciseId } } });
    revalidatePath("/app/exercises");
    return { favorited: false };
  }

  await prisma.favoriteExercise.create({ data: { userId: user.id, exerciseId } });
  revalidatePath("/app/exercises");
  return { favorited: true };
}
