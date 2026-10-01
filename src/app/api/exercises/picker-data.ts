import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { exerciseSearchWhere } from "@/lib/data/exercise-query";
import { searchExerciseIds, searchMuscles } from "@/lib/data/exercises";
import { EQUIPMENT_FOR_ACCESS } from "@/lib/data/alternatives";
import {
  MY_EQUIPMENT,
  PICKER_PAGE_SIZE,
  equipmentFacet,
  volumeMuscle,
  type PickerExercise,
  type PickerPage,
  type PickerQuery,
} from "@/lib/programming/exercise-facets";

/**
 * The exercise picker's data: the builder's search (GET /api/exercises/search)
 * and the thumbnails/muscles the builder shows for the exercises already in a
 * program. One select for both, so a row added from the picker and a row
 * loaded with the page carry the same fields.
 */
const PICKER_SELECT = {
  id: true,
  slug: true,
  namePt: true,
  mechanics: true,
  category: true,
  equipmentId: true,
  movementPatternId: true,
  equipment: { select: { namePt: true } },
  muscles: { select: { role: true, muscleId: true, muscle: { select: { namePt: true, group: true, sortOrder: true } } } },
  media: { take: 1, orderBy: { sortOrder: "asc" as const }, select: { url: true } },
} satisfies Prisma.ExerciseSelect;

type PickerRow = Prisma.ExerciseGetPayload<{ select: typeof PICKER_SELECT }>;

function toPickerExercise(e: PickerRow): PickerExercise {
  const primary = e.muscles.filter((m) => m.role === "PRIMARY").sort((a, b) => a.muscle.sortOrder - b.muscle.sortOrder);
  return {
    id: e.id,
    slug: e.slug,
    namePt: e.namePt,
    imageUrl: e.media[0]?.url ?? null,
    primaryMuscle: primary[0]?.muscle.namePt ?? null,
    equipment: e.equipment?.namePt ?? null,
    equipmentId: e.equipmentId,
    mechanics: e.mechanics,
    movementPattern: e.movementPatternId,
    primaryMuscleIds: primary.map((m) => m.muscleId),
    secondaryMuscleIds: e.muscles.filter((m) => m.role === "SECONDARY").map((m) => m.muscleId),
    primaryGroups: [...new Set(primary.map((m) => m.muscle.group as string))],
    category: e.category,
  };
}

/** The exercises with these ids (any order) — the builder's rows, a restored draft's new ones. */
export async function pickerExercisesByIds(ids: string[]): Promise<PickerExercise[]> {
  const unique = [...new Set(ids)].slice(0, 200);
  if (unique.length === 0) return [];
  const rows = await prisma.exercise.findMany({ where: { id: { in: unique } }, select: PICKER_SELECT });
  return rows.map(toPickerExercise);
}

/** How many of a user's lists the picker reads: favorites and recent exercises. */
const LIST_CAP = 60;

/**
 * "Recentes": exercises the user trained lately (newest first), then the ones
 * in their current programs — what they are likely to add again.
 */
async function recentExerciseIds(userId: string): Promise<string[]> {
  const [logged, programmed] = await Promise.all([
    prisma.workoutExerciseLog.findMany({
      where: { userId, wasSkipped: false, session: { status: { not: "DISCARDED" } } },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { exerciseId: true },
    }),
    prisma.userProgramExercise.findMany({
      where: { day: { program: { userId, status: { in: ["ACTIVE", "DRAFT"] } } } },
      orderBy: { day: { program: { updatedAt: "desc" } } },
      take: 200,
      select: { exerciseId: true },
    }),
  ]);
  return [...new Set([...logged, ...programmed].map((r) => r.exerciseId))].slice(0, LIST_CAP);
}

async function favoriteExerciseIds(userId: string): Promise<string[]> {
  const favorites = await prisma.favoriteExercise.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: LIST_CAP,
    select: { exerciseId: true },
  });
  return favorites.map((f) => f.exerciseId);
}

/**
 * One page of the picker. The muscle chip filters on primary muscles, the
 * equipment chip on the equipment (the user's own for "Seu equipamento"). A
 * text search in the catalog ranks like the library (searchExerciseIds: names,
 * pt-BR aliases, muscle words, starts-with first; stretches only when asked);
 * browsing leaves stretches out, like the library, and is ordered curated →
 * popular → name. Favoritos and Recentes are the user's own lists (stretches
 * included), searched with the same words as Todos, in the user's order.
 */
export async function searchPickerExercises(
  userId: string,
  query: PickerQuery,
  equipmentAccess: string | null,
): Promise<PickerPage> {
  const muscle = volumeMuscle(query.muscle);
  const equipmentIds =
    query.equipment === MY_EQUIPMENT
      ? (EQUIPMENT_FOR_ACCESS[equipmentAccess ?? "FULL_GYM"] ?? null)
      : ((equipmentFacet(query.equipment)?.ids as readonly string[] | undefined) ?? null);

  const filtersWhere: Prisma.ExerciseWhereInput = {
    isPublished: true,
    ...(muscle ? { muscles: { some: { role: "PRIMARY", muscleId: { in: [...muscle.muscleIds] } } } } : {}),
    ...(equipmentIds ? { equipmentId: { in: [...equipmentIds] } } : {}),
  };
  const skip = (query.page - 1) * PICKER_PAGE_SIZE;

  if (query.tab !== "todos") {
    const ids = query.tab === "favoritos" ? await favoriteExerciseIds(userId) : await recentExerciseIds(userId);
    // AND-ed, not spread: a query with no searchable word ("-") is {id: {in: []}}
    // and must still match nothing, not be overwritten by the list's ids.
    const text = query.q.trim() ? exerciseSearchWhere(query.q, await searchMuscles()) : {};
    const rows = ids.length
      ? await prisma.exercise.findMany({ where: { AND: [filtersWhere, text, { id: { in: ids } }] }, select: PICKER_SELECT })
      : [];
    const rank = new Map(ids.map((id, i) => [id, i]));
    rows.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
    const items = rows.slice(skip, skip + PICKER_PAGE_SIZE).map(toPickerExercise);
    return { items, total: rows.length, page: query.page, hasMore: skip + PICKER_PAGE_SIZE < rows.length };
  }

  if (query.q.trim()) {
    const ids = await searchExerciseIds(query.q, filtersWhere);
    const pageIds = ids.slice(skip, skip + PICKER_PAGE_SIZE);
    const rows = pageIds.length
      ? await prisma.exercise.findMany({ where: { id: { in: pageIds } }, select: PICKER_SELECT })
      : [];
    const at = new Map(pageIds.map((id, i) => [id, i]));
    rows.sort((a, b) => (at.get(a.id) ?? 0) - (at.get(b.id) ?? 0));
    return { items: rows.map(toPickerExercise), total: ids.length, page: query.page, hasMore: skip + PICKER_PAGE_SIZE < ids.length };
  }

  // Browsing only: filtersWhere is also the search's base above, and a search
  // for "alongamento" must still find the stretches.
  const where: Prisma.ExerciseWhereInput = { AND: [filtersWhere, { category: { not: "STRETCHING" } }] };
  const [rows, total] = await Promise.all([
    prisma.exercise.findMany({
      where,
      select: PICKER_SELECT,
      orderBy: [{ isCurated: "desc" }, { popularity: "desc" }, { namePt: "asc" }],
      skip,
      take: PICKER_PAGE_SIZE,
    }),
    prisma.exercise.count({ where }),
  ]);
  return { items: rows.map(toPickerExercise), total, page: query.page, hasMore: skip + rows.length < total };
}
