/**
 * The exercise picker's facets (muscle, equipment, list) and the muscles the
 * builder's weekly-volume strip counts. Pure and client-safe: the picker
 * chips, the volume strip and the search route (GET /api/exercises/search)
 * all read these, so a chip and the query behind it never disagree.
 */

/** An exercise as the picker lists it — and as the builder keeps it for thumbnails and volume. */
export interface PickerExercise {
  id: string;
  slug: string;
  namePt: string;
  imageUrl: string | null;
  /** The first primary muscle's name ("Peitoral"). */
  primaryMuscle: string | null;
  /** The equipment's name ("Halteres"). */
  equipment: string | null;
  equipmentId: string | null;
  mechanics: "COMPOUND" | "ISOLATION" | null;
  movementPattern: string | null;
  primaryMuscleIds: string[];
  secondaryMuscleIds: string[];
  /** MuscleGroup of the primary muscles (CHEST, LEGS…), for the program rules. */
  primaryGroups: string[];
}

export interface PickerPage {
  items: PickerExercise[];
  total: number;
  page: number;
  hasMore: boolean;
}

/**
 * The muscles people program by — how a lifter counts weekly sets ("peito",
 * "costas", "bíceps"), not the 23 anatomical ones. Each lists the Muscle ids
 * it covers. Also the picker's muscle chips, so "Adicionar" from a low muscle
 * in the volume strip opens the picker on exactly that chip.
 */
export const VOLUME_MUSCLES = [
  { key: "peito", label: "Peitoral", muscleIds: ["chest"] },
  { key: "costas", label: "Costas", muscleIds: ["lats", "middle-back", "rhomboids", "traps"] },
  { key: "ombros", label: "Ombros", muscleIds: ["shoulders", "anterior-deltoid", "lateral-deltoid", "posterior-deltoid"] },
  { key: "biceps", label: "Bíceps", muscleIds: ["biceps"] },
  { key: "triceps", label: "Tríceps", muscleIds: ["triceps"] },
  { key: "quadriceps", label: "Quadríceps", muscleIds: ["quadriceps"] },
  { key: "posteriores", label: "Posteriores", muscleIds: ["hamstrings"] },
  { key: "gluteos", label: "Glúteos", muscleIds: ["glutes", "abductors"] },
  { key: "panturrilhas", label: "Panturrilhas", muscleIds: ["calves"] },
  { key: "abdomen", label: "Abdômen", muscleIds: ["abdominals", "obliques"] },
] as const;

export type VolumeMuscleKey = (typeof VOLUME_MUSCLES)[number]["key"];

/**
 * Whether an exercise's sets count as training volume: stretches and cardio
 * don't — in the builder's weekly strip, the program rules, Today's weekly
 * review, progress charts and the fatigue signal alike.
 */
export function countsAsVolume(category: string | null | undefined): boolean {
  return category !== "STRETCHING" && category !== "CARDIO";
}

export function volumeMuscle(key: string | null | undefined) {
  return VOLUME_MUSCLES.find((m) => m.key === key) ?? null;
}

/**
 * Equipment chips. "meu" is the user's own equipment (Profile.equipmentAccess),
 * resolved on the server — the default chip for anyone who didn't say "academia".
 */
export const EQUIPMENT_FACETS = [
  { key: "halteres", label: "Halteres", ids: ["dumbbell"] },
  { key: "barra", label: "Barra", ids: ["barbell", "ez-bar", "smith-machine"] },
  { key: "maquina", label: "Máquina", ids: ["machine", "smith-machine"] },
  { key: "cabo", label: "Cabo", ids: ["cable"] },
  { key: "corpo", label: "Peso do corpo", ids: ["bodyweight", "none", "pull-up-bar"] },
  { key: "kettlebell", label: "Kettlebell", ids: ["kettlebell"] },
  { key: "elastico", label: "Elástico", ids: ["resistance-band"] },
] as const;

export const MY_EQUIPMENT = "meu";

export function equipmentFacet(key: string | null | undefined) {
  return EQUIPMENT_FACETS.find((f) => f.key === key) ?? null;
}

/** The picker's lists: the whole catalog, the user's favorites, what they trained or programmed lately. */
export const PICKER_TABS = [
  { key: "todos", label: "Todos" },
  { key: "favoritos", label: "Favoritos" },
  { key: "recentes", label: "Recentes" },
] as const;

export type PickerTab = (typeof PICKER_TABS)[number]["key"];

export const PICKER_PAGE_SIZE = 24;

export interface PickerQuery {
  q: string;
  muscle: string | null;
  equipment: string | null;
  tab: PickerTab;
  page: number;
}

/** The search route's URL for a query (the same string is the client's cache key). */
export function pickerSearchUrl(query: PickerQuery): string {
  const params = new URLSearchParams();
  const q = query.q.trim();
  if (q) params.set("q", q);
  if (query.muscle) params.set("muscle", query.muscle);
  if (query.equipment) params.set("equipment", query.equipment);
  if (query.tab !== "todos") params.set("tab", query.tab);
  if (query.page > 1) params.set("page", String(query.page));
  const s = params.toString();
  return s ? `/api/exercises/search?${s}` : "/api/exercises/search";
}

/** Reads and bounds a search URL's params (anything unknown falls back to "no filter"). */
export function parsePickerQuery(params: URLSearchParams): PickerQuery {
  const muscle = params.get("muscle");
  const equipment = params.get("equipment");
  const tab = params.get("tab");
  const page = Number(params.get("page") ?? "1");
  return {
    q: (params.get("q") ?? "").slice(0, 100),
    muscle: volumeMuscle(muscle) ? muscle : null,
    equipment: equipment === MY_EQUIPMENT || equipmentFacet(equipment) ? equipment : null,
    tab: PICKER_TABS.some((t) => t.key === tab) ? (tab as PickerTab) : "todos",
    page: Number.isSafeInteger(page) && page >= 1 && page <= 200 ? page : 1,
  };
}
