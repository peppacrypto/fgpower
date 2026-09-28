import "server-only";
import { cache } from "react";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { MUSCLE_GROUPS } from "@/lib/constants/muscle-groups";
import {
  asksForStretching,
  exerciseSearchWhere,
  rankExercises,
  type MuscleForSearch,
} from "@/lib/data/exercise-query";

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
  /** Only these exercises (the user's program, their favorites). Stretches are kept: they were chosen. */
  onlyIds?: string[];
  page?: number;
  pageSize?: number;
}

/**
 * Muscles as the search reads them (reference data: 23 rows that change only
 * with a reseed), kept for a few minutes instead of re-read on every keystroke.
 */
const MUSCLES_TTL_MS = 10 * 60_000;
let musclesMemo: { at: number; value: Promise<MuscleForSearch[]> } | null = null;
export function searchMuscles(): Promise<MuscleForSearch[]> {
  if (!musclesMemo || Date.now() - musclesMemo.at > MUSCLES_TTL_MS) {
    const value = prisma.muscle.findMany({ select: { id: true, namePt: true, nameEn: true, group: true } });
    musclesMemo = { at: Date.now(), value };
    value.catch(() => {
      musclesMemo = null;
    });
  }
  return musclesMemo.value;
}

const NO_STRETCHES: Prisma.ExerciseWhereInput = { category: { not: "STRETCHING" } };
const DIFFICULTIES = new Set(["BEGINNER", "INTERMEDIATE", "ADVANCED"]);

/**
 * The library, the builder's picker and the public catalog. Browsing lists
 * curated and most-used exercises first; a search ranks by how well the name
 * answers it (exercise-query rankExercises). Stretches stay out unless the
 * search asks for them — or they are the only match ("postura da criança").
 */
export async function listExercises(filters: ExerciseFilters = {}) {
  const requestedPage = filters.page && Number.isSafeInteger(filters.page) && filters.page >= 1 ? filters.page : 1;
  const pageSize = filters.pageSize ?? 24;
  const q = filters.q?.trim() ?? "";

  const base: Prisma.ExerciseWhereInput = {
    isPublished: true,
    ...(filters.equipmentId ? { equipmentId: filters.equipmentId } : {}),
    ...(filters.movementPatternId ? { movementPatternId: filters.movementPatternId } : {}),
    // Enum values are checked here too: an unknown one would fail the whole query.
    ...(filters.difficulty && DIFFICULTIES.has(filters.difficulty) ? { difficulty: filters.difficulty as never } : {}),
    ...(filters.muscleGroup && (MUSCLE_GROUPS as readonly string[]).includes(filters.muscleGroup)
      ? { muscles: { some: { role: "PRIMARY" as const, muscle: { group: filters.muscleGroup as never } } } }
      : {}),
    ...(filters.onlyIds ? { id: { in: filters.onlyIds } } : {}),
  };
  const stretchesAsked = Boolean(filters.onlyIds) || (q !== "" && asksForStretching(q));

  if (!q) {
    const where: Prisma.ExerciseWhereInput = stretchesAsked ? base : { AND: [base, NO_STRETCHES] };
    const findPage = (page: number) =>
      prisma.exercise.findMany({
        where,
        select: CARD_SELECT,
        orderBy: [{ isCurated: "desc" }, { popularity: "desc" }, { namePt: "asc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      });

    // Page 1 (the library's first view) always exists, so both queries run
    // together. Past it, count first so a page beyond the end (an old link, a
    // hand-edited URL) serves the last page instead of "Página 999 de 37".
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

  // A search: rank every match, then load the cards of the page shown.
  const ranked = await searchExerciseIds(q, base, { withStretches: stretchesAsked });
  const total = ranked.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const ids = ranked.slice((page - 1) * pageSize, page * pageSize);
  const cards = ids.length > 0 ? await prisma.exercise.findMany({ where: { id: { in: ids } }, select: CARD_SELECT }) : [];
  const order = new Map(ids.map((id, i) => [id, i]));
  const items = cards.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return { items, total, page, pageSize, totalPages };
}

/**
 * Every exercise inside `base` that answers the search `q`, best first: names,
 * aliases and primary muscles (exercise-query), ranked by rankExercises.
 * Stretches stay out unless the search asks for them (or `withStretches`), or
 * they are the only match. The library and the builder's picker share it; the
 * candidates are a few hundred rows at most, read by name only.
 */
export async function searchExerciseIds(
  q: string,
  base: Prisma.ExerciseWhereInput = { isPublished: true },
  { withStretches = false }: { withStretches?: boolean } = {},
): Promise<string[]> {
  const muscles = await searchMuscles();
  const text = exerciseSearchWhere(q, muscles);
  const stretchesAsked = withStretches || asksForStretching(q);
  const findCandidates = (stretches: boolean) =>
    prisma.exercise.findMany({
      where: { AND: stretches ? [base, text] : [base, text, NO_STRETCHES] },
      select: {
        id: true,
        namePt: true,
        nameEn: true,
        popularity: true,
        isCurated: true,
        aliases: { select: { alias: true } },
        muscles: { where: { role: "PRIMARY" }, select: { muscleId: true } },
      },
    });
  let candidates = await findCandidates(stretchesAsked);
  if (candidates.length === 0 && !stretchesAsked) candidates = await findCandidates(true);
  return rankExercises(
    q,
    candidates.map((c) => ({ ...c, aliases: c.aliases.map((a) => a.alias), muscleIds: c.muscles.map((m) => m.muscleId) })),
    muscles,
  ).map((c) => c.id);
}

/**
 * One exercise with everything its technique page shows. Wrapped in React
 * cache(): generateMetadata and the page ask for the same slug in one request,
 * and the loader is ~15 queries (one per relation).
 */
export const getExerciseBySlug = cache(async (slug: string) => {
  return prisma.exercise.findUnique({
    where: { slug },
    include: {
      equipment: true,
      movementPattern: true,
      muscles: { include: { muscle: true }, orderBy: { role: "asc" } },
      media: { orderBy: { sortOrder: "asc" } },
      evidence: { include: { source: true }, orderBy: { sortOrder: "asc" } },
      relationsFrom: {
        orderBy: { sortOrder: "asc" },
        include: {
          related: { select: CARD_SELECT },
        },
      },
    },
  });
});

export async function getExercisesByIds(ids: string[]) {
  if (ids.length === 0) return [];
  return prisma.exercise.findMany({ where: { id: { in: ids } }, select: CARD_SELECT });
}

/** The program the user is running (latest active enrollment), or null. */
const activeProgramOf = cache(async (userId: string) => {
  const enrollment = await prisma.programEnrollment.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { startedAt: "desc" },
    select: { program: { select: { id: true, name: true } } },
  });
  return enrollment?.program ?? null;
});

/**
 * Library exercises with no movement pattern — what the "Movimento" filter
 * can't list (it says so). Memoized like the muscles: it changes only with a reseed.
 */
let unclassifiedMemo: { at: number; value: Promise<number> } | null = null;
export function countUnclassifiedPatterns(): Promise<number> {
  if (!unclassifiedMemo || Date.now() - unclassifiedMemo.at > MUSCLES_TTL_MS) {
    const value = prisma.exercise.count({ where: { isPublished: true, movementPatternId: null, ...NO_STRETCHES } });
    unclassifiedMemo = { at: Date.now(), value };
    value.catch(() => {
      unclassifiedMemo = null;
    });
  }
  return unclassifiedMemo.value;
}

/** Exercise ids of the program the user is running — the library's "Do meu programa". */
export async function listActiveProgramExerciseIds(userId: string): Promise<string[]> {
  const program = await activeProgramOf(userId);
  if (!program) return [];
  const rows = await prisma.userProgramExercise.findMany({
    where: { day: { programId: program.id } },
    select: { exerciseId: true },
    distinct: ["exerciseId"],
  });
  return rows.map((r) => r.exerciseId);
}

/** Exercise ids the user favorited — the library's "Favoritos". */
export async function listFavoriteExerciseIds(userId: string): Promise<string[]> {
  const rows = await prisma.favoriteExercise.findMany({ where: { userId }, select: { exerciseId: true } });
  return rows.map((r) => r.exerciseId);
}

export interface ProgramUse {
  programId: string;
  programName: string;
  dayName: string;
  sets: number;
  repMin: number;
  repMax: number;
  notes: string | null;
}

/**
 * Where an exercise sits in the program the user is running — the technique
 * page's "No seu programa: Segunda — Superior (pesado) · 3×8–12".
 */
export async function getProgramUsesBySlug(userId: string, slug: string): Promise<ProgramUse[]> {
  const program = await activeProgramOf(userId);
  if (!program) return [];
  const rows = await prisma.userProgramExercise.findMany({
    where: { exercise: { slug }, day: { programId: program.id } },
    orderBy: [{ day: { dayIndex: "asc" } }, { sortOrder: "asc" }],
    select: { sets: true, repMin: true, repMax: true, notes: true, day: { select: { name: true } } },
  });
  return rows.map((r) => ({
    programId: program.id,
    programName: program.name,
    dayName: r.day.name,
    sets: r.sets,
    repMin: r.repMin,
    repMax: r.repMax,
    notes: r.notes,
  }));
}

/** Whether the user favorited the exercise at `slug` (no need to load the exercise first). */
export async function isFavoriteSlug(userId: string, slug: string): Promise<boolean> {
  const row = await prisma.favoriteExercise.findFirst({ where: { userId, exercise: { slug } }, select: { exerciseId: true } });
  return Boolean(row);
}

export type ExerciseCard = Awaited<ReturnType<typeof listExercises>>["items"][number];
