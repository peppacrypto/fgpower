"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";

export type FavoriteResult = { ok: true; favorited: boolean } | { ok: false; error: string };

/**
 * Sets (or, without `favorite`, flips) an exercise's favorite flag. Passing
 * the wanted state makes a retried or double-sent call idempotent. Failures
 * come back as `{ ok: false }` so the button rolls back inline.
 */
export async function toggleFavoriteExercise(exerciseId: string, favorite?: boolean): Promise<FavoriteResult> {
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return { ok: false, error: "Entre na sua conta para salvar favoritos." };

  try {
    const where = { userId_exerciseId: { userId: user.id, exerciseId } };
    const existing = await prisma.favoriteExercise.findUnique({ where });
    const want = favorite ?? !existing;

    if (want && !existing) {
      await prisma.favoriteExercise.create({ data: { userId: user.id, exerciseId } });
    } else if (!want && existing) {
      await prisma.favoriteExercise.delete({ where });
    }
    revalidatePath("/app/exercises");
    revalidatePath("/app/profile");
    return { ok: true, favorited: want };
  } catch (err) {
    // A concurrent duplicate create means it's already a favorite.
    if ((err as { code?: string }).code === "P2002") return { ok: true, favorited: true };
    console.error("toggleFavoriteExercise failed", err);
    return { ok: false, error: "Não foi possível salvar o favorito. Tente de novo." };
  }
}
