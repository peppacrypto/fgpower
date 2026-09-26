import "server-only";
import { prisma } from "@/lib/db";
import { exerciseSearchWhere } from "@/lib/data/exercise-query";

const CARD_SELECT = {
  id: true,
  slug: true,
  nameEn: true,
  namePt: true,
  difficulty: true,
  mechanics: true,
  isCurated: true,
  equipment: { select: { id: true, nameEn: true, namePt: true } },
  movementPattern: { select: { id: true, nameEn: true, namePt: true } },
  muscles: {
    where: { role: "PRIMARY" as const },
    select: { muscle: { select: { id: true, nameEn: true, namePt: true, group: true } } },
  },
  media: { orderBy: { sortOrder: "asc" as const }, take: 1 },
} as const;

export interface ExerciseFilters {
  q?: string;
  muscleGroup?: string;
  equipmentId?: string;
  movementPatternId?: string;
  difficulty?: string;
  page?: number;
  pageSize?: number;
}

export async function listExercises(filters: ExerciseFilters = {}) {
  const requestedPage = filters.page && Number.isSafeInteger(filters.page) && filters.page >= 1 ? filters.page : 1;
  const pageSize = filters.pageSize ?? 24;

  const where = {
    isPublished: true,
    // Every word of the query must match (in any order), with light plural stemming.
    ...(filters.q ? exerciseSearchWhere(filters.q) : {}),
    ...(filters.equipmentId ? { equipmentId: filters.equipmentId } : {}),
    ...(filters.movementPatternId ? { movementPatternId: filters.movementPatternId } : {}),
    ...(filters.difficulty ? { difficulty: filters.difficulty as never } : {}),
    ...(filters.muscleGroup
      ? { muscles: { some: { role: "PRIMARY" as const, muscle: { group: filters.muscleGroup as never } } } }
      : {}),
  };

  const findPage = (page: number) =>
    prisma.exercise.findMany({
      where,
      select: CARD_SELECT,
      orderBy: [{ isCurated: "desc" }, { popularity: "desc" }, { namePt: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

  // Page 1 (the library's first view, the builder picker) always exists, so
  // both queries run together. Past it, count first so a page beyond the end
  // (an old link, a hand-edited URL) serves the last page instead of
  // "Página 999 de 37" and nothing.
  let total: number;
  let page = requestedPage;
  let items: Awaited<ReturnType<typeof findPage>>;
  if (page === 1) {
    [items, total] = await Promise.all([findPage(1), prisma.exercise.count({ where })]);
  } else {
    total = await prisma.exercise.count({ where });
    page = Math.min(page, Math.max(1, Math.ceil(total / pageSize)));
    items = await findPage(page);
  }

  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getExerciseBySlug(slug: string) {
  return prisma.exercise.findUnique({
    where: { slug },
    include: {
      equipment: true,
      movementPattern: true,
      muscles: { include: { muscle: true }, orderBy: { role: "asc" } },
      media: { orderBy: { sortOrder: "asc" } },
      evidence: { include: { source: true }, orderBy: { sortOrder: "asc" } },
      relationsFrom: {
        include: {
          related: { select: CARD_SELECT },
        },
      },
    },
  });
}

export async function getExercisesByIds(ids: string[]) {
  if (ids.length === 0) return [];
  return prisma.exercise.findMany({ where: { id: { in: ids } }, select: CARD_SELECT });
}

export type ExerciseCard = Awaited<ReturnType<typeof listExercises>>["items"][number];
