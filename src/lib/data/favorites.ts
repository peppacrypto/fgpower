import "server-only";
import { prisma } from "@/lib/db";

export async function listFavoriteExercises(userId: string) {
  return prisma.favoriteExercise.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { exercise: { include: { equipment: true, media: { take: 1, orderBy: { sortOrder: "asc" } } } } },
  });
}
