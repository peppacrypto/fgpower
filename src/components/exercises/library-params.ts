import { MUSCLE_GROUPS } from "@/lib/constants/muscle-groups";

/**
 * The exercise library's URL (both /app/exercises and the public /exercises):
 * what the filter bar writes and the page reads. Enum-backed params are
 * checked here — a hand-edited ?muscleGroup=FOO must list everything, not
 * crash the query.
 */

export const DIFFICULTY_OPTIONS = [
  { value: "BEGINNER", label: "Iniciante" },
  { value: "INTERMEDIATE", label: "Intermediário" },
  { value: "ADVANCED", label: "Avançado" },
] as const;

/** Signed-in shortcuts: the program being run, the hearted exercises. */
export const LIBRARY_LISTS = [
  { value: "programa", label: "Do meu programa" },
  { value: "favoritos", label: "Favoritos" },
] as const;
export type LibraryList = (typeof LIBRARY_LISTS)[number]["value"];

export const LIBRARY_KEYS = ["q", "muscleGroup", "equipmentId", "movementPatternId", "difficulty", "lista"] as const;
export type LibraryKey = (typeof LIBRARY_KEYS)[number];
export type LibraryState = Record<LibraryKey, string>;

type SearchParamsLike = Record<string, string | string[] | undefined>;

const one = (sp: SearchParamsLike, key: string) => {
  const v = sp[key];
  return typeof v === "string" ? v : "";
};

export function parseLibraryParams(sp: SearchParamsLike): LibraryState & { page: number } {
  const muscleGroup = one(sp, "muscleGroup");
  const difficulty = one(sp, "difficulty");
  const lista = one(sp, "lista");
  const page = Math.floor(Number(one(sp, "page")));
  return {
    q: one(sp, "q").slice(0, 100),
    muscleGroup: (MUSCLE_GROUPS as readonly string[]).includes(muscleGroup) ? muscleGroup : "",
    equipmentId: one(sp, "equipmentId").slice(0, 64),
    movementPatternId: one(sp, "movementPatternId").slice(0, 64),
    difficulty: DIFFICULTY_OPTIONS.some((d) => d.value === difficulty) ? difficulty : "",
    lista: LIBRARY_LISTS.some((l) => l.value === lista) ? lista : "",
    page: Number.isSafeInteger(page) && page >= 1 ? page : 1,
  };
}

/** Whether anything narrows the list (the text included). */
export function hasLibraryFilters(state: LibraryState): boolean {
  return LIBRARY_KEYS.some((k) => state[k].trim() !== "");
}

/** `basePath?…` for a state (empty values dropped, page reset unless given). */
export function libraryHref(basePath: string, state: LibraryState, page?: number): string {
  const params = new URLSearchParams();
  for (const key of LIBRARY_KEYS) {
    const value = state[key].trim();
    if (value) params.set(key, value);
  }
  if (page && page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
