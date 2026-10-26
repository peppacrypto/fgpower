/**
 * The gym gear each exercise needs ("aparelhos") and how its load is added.
 *
 * The catalog's equipment tag is too coarse for either question: "machine"
 * holds a leg press (plates, both sides), a leg extension (a pin in a stack)
 * and a treadmill; "cable" holds a lat pulldown station and a crossover. So
 * every exercise also maps to the apparatus it can't be done without — an
 * anyOf list (a seated cable row works on a low-row station or a crossover) —
 * and to its LoadKind (lib/training/load-grid). The map is curated content
 * (gear-map.generated.ts); anything it doesn't list falls back to its
 * catalog tag.
 *
 * Pure: no I/O, safe on the client.
 */
import type { LoadKind } from "@/lib/training/load-grid";
import { GEAR_MAP } from "./gear-map.generated";

export const GEAR_IDS = [
  // Free weights & small gear
  "dumbbells",
  "barbell",
  "ez-bar",
  "trap-bar",
  "landmine",
  "kettlebells",
  "preacher-bench",
  "bands",
  "stability-ball",
  "medicine-ball",
  "foam-roller",
  "plyo-box",
  // Bars & bodyweight stations
  "pull-up-bar",
  "dip-bars",
  "rings",
  "assisted-pullup",
  "back-extension",
  "ghd",
  "ab-wheel",
  // Cable stations
  "cable-crossover",
  "lat-pulldown",
  "low-row",
  // Machines — legs & hips
  "leg-press",
  "hack-squat",
  "smith",
  "leg-extension",
  "leg-curl-lying",
  "leg-curl-seated",
  "leg-curl-standing",
  "hip-adductor",
  "hip-abductor",
  "glute-machine",
  "calf-standing",
  "calf-seated",
  // Machines — upper body
  "pec-deck",
  "chest-press-machine",
  "shoulder-press-machine",
  "lateral-raise-machine",
  "row-machine",
  "t-bar-row",
  "pulldown-machine",
  "biceps-machine",
  "triceps-machine",
  "ab-machine",
  // Cardio & other
  "treadmill",
  "bike",
  "rower",
  "elliptical",
  "stair-climber",
  "sled",
  "other-machine",
  "specialty",
] as const;
export type GearId = (typeof GEAR_IDS)[number];

export type GearGroup = "free" | "stations" | "cables" | "legs" | "upper" | "accessories" | "cardio";

export interface GearInfo {
  id: GearId;
  /** What a Brazilian gym-goer calls it. */
  namePt: string;
  group: GearGroup;
  /** Listed in Settings → Minha academia; catch-alls (other machine, strongman gear) aren't. */
  listed: boolean;
}

const g = (id: GearId, namePt: string, group: GearGroup, listed = true): GearInfo => ({ id, namePt, group, listed });

export const GEAR: readonly GearInfo[] = [
  g("dumbbells", "Halteres", "free"),
  g("barbell", "Barra e anilhas", "free"),
  g("ez-bar", "Barra W", "free"),
  g("trap-bar", "Barra hexagonal", "free"),
  g("landmine", "Landmine (barra no canto)", "free"),
  g("kettlebells", "Kettlebell", "free"),
  g("preacher-bench", "Banco Scott", "free"),
  g("pull-up-bar", "Barra fixa", "stations"),
  g("dip-bars", "Paralelas", "stations"),
  g("rings", "Argolas / fita de suspensão", "stations"),
  // No catalog exercise needs these yet (assisted machines aren't progressed in kg; the
  // glute and lateral-raise machines have no exercise of their own): a box that changes
  // nothing isn't offered. gear.test.ts keeps every listed id in use.
  g("assisted-pullup", "Graviton", "stations", false),
  g("back-extension", "Banco romano (lombar)", "stations"),
  g("ghd", "GHD", "stations"),
  g("ab-wheel", "Roda abdominal", "stations"),
  g("plyo-box", "Caixa de salto", "stations"),
  g("cable-crossover", "Crossover / polia", "cables"),
  g("lat-pulldown", "Puxador (pulley alto)", "cables"),
  g("low-row", "Remada baixa", "cables"),
  g("leg-press", "Leg press", "legs"),
  g("hack-squat", "Hack", "legs"),
  g("smith", "Smith", "legs"),
  g("leg-extension", "Cadeira extensora", "legs"),
  g("leg-curl-lying", "Mesa flexora", "legs"),
  g("leg-curl-seated", "Cadeira flexora", "legs"),
  g("leg-curl-standing", "Flexora em pé", "legs"),
  g("hip-adductor", "Cadeira adutora", "legs"),
  g("hip-abductor", "Cadeira abdutora", "legs"),
  g("glute-machine", "Glúteo máquina", "legs", false),
  g("calf-standing", "Panturrilha em pé (máquina)", "legs"),
  g("calf-seated", "Panturrilha sentado (máquina)", "legs"),
  g("pec-deck", "Voador (peck deck)", "upper"),
  g("chest-press-machine", "Supino máquina / articulado", "upper"),
  g("shoulder-press-machine", "Desenvolvimento máquina", "upper"),
  g("lateral-raise-machine", "Elevação lateral máquina", "upper", false),
  g("row-machine", "Remada máquina / articulada", "upper"),
  g("t-bar-row", "Remada cavalinho", "upper"),
  g("pulldown-machine", "Puxada articulada", "upper"),
  g("biceps-machine", "Rosca máquina", "upper"),
  g("triceps-machine", "Tríceps máquina", "upper"),
  g("ab-machine", "Abdominal máquina", "upper"),
  g("bands", "Elásticos", "accessories"),
  g("stability-ball", "Bola suíça", "accessories"),
  g("medicine-ball", "Bola medicinal", "accessories"),
  g("foam-roller", "Rolo de liberação", "accessories"),
  g("treadmill", "Esteira", "cardio"),
  g("bike", "Bicicleta ergométrica", "cardio"),
  g("rower", "Remo ergômetro", "cardio"),
  g("elliptical", "Elíptico", "cardio"),
  g("stair-climber", "Escada / simulador de escada", "cardio"),
  g("sled", "Trenó", "cardio"),
  g("other-machine", "Outra máquina", "upper", false),
  g("specialty", "Implemento especial", "accessories", false),
];

export const GEAR_GROUP_LABEL: Record<GearGroup, string> = {
  free: "Pesos livres",
  stations: "Barras e estações",
  cables: "Polias",
  legs: "Máquinas de perna e glúteo",
  upper: "Máquinas de tronco e braço",
  accessories: "Acessórios",
  cardio: "Cardio e outros",
};

const BY_ID = new Map<string, GearInfo>(GEAR.map((x) => [x.id, x]));

export function isGearId(id: string): id is GearId {
  return BY_ID.has(id);
}

/** "Hack" — the gear's name, or the id when unknown (an old value). */
export function gearName(id: string): string {
  return BY_ID.get(id)?.namePt ?? id;
}

/** The fields an exercise is judged on — what every catalog query already selects. */
export interface GearSubject {
  slug: string;
  equipmentId: string | null;
  /** ExerciseCategory: a STRETCHING drill is never progressed in kg. */
  category?: string | null;
}

/** By catalog tag, for what the curated map doesn't list. */
const FALLBACK: Record<string, { gear: GearId[]; load: LoadKind }> = {
  dumbbell: { gear: ["dumbbells"], load: "DUMBBELL" },
  kettlebell: { gear: ["kettlebells"], load: "KETTLEBELL" },
  barbell: { gear: ["barbell"], load: "BARBELL" },
  "ez-bar": { gear: ["ez-bar"], load: "BARBELL" },
  "smith-machine": { gear: ["smith"], load: "BARBELL" },
  machine: { gear: ["other-machine"], load: "STACK" },
  cable: { gear: ["cable-crossover"], load: "CABLE" },
  bodyweight: { gear: [], load: "BODYWEIGHT" },
  none: { gear: [], load: "BODYWEIGHT" },
  bench: { gear: [], load: "BODYWEIGHT" },
  "pull-up-bar": { gear: ["pull-up-bar"], load: "BODYWEIGHT" },
  "resistance-band": { gear: ["bands"], load: "NONE" },
  "exercise-ball": { gear: ["stability-ball"], load: "NONE" },
  "medicine-ball": { gear: ["medicine-ball"], load: "FIXED_LIGHT" },
  "foam-roller": { gear: ["foam-roller"], load: "NONE" },
  "other-equipment": { gear: ["specialty"], load: "PLATE_ONE_SIDE" },
};

const NONE_REQUIRED: readonly GearId[] = [];

function entryOf(ex: GearSubject): { gear: readonly GearId[]; load: LoadKind; requires: readonly GearId[] } {
  const curated = GEAR_MAP[ex.slug];
  if (curated) return { gear: curated[0], load: curated[1], requires: curated[2] ?? NONE_REQUIRED };
  const fallback = FALLBACK[ex.equipmentId ?? "none"] ?? { gear: [], load: "BODYWEIGHT" as const };
  return { ...fallback, requires: NONE_REQUIRED };
}

/** The gear an exercise can be done on (any one of them); empty = needs nothing a gym could lack. */
export function exerciseGear(ex: GearSubject): readonly GearId[] {
  return entryOf(ex).gear;
}

/**
 * Gear the exercise needs on top of that, every piece of it: the Banco Scott of
 * a cable preacher curl, the bands of a band-assisted pull-up.
 */
export function requiredGear(ex: GearSubject): readonly GearId[] {
  return entryOf(ex).requires;
}

/** How load is added on the exercise's equipment; a stretch is never progressed in kg. */
export function loadKindOf(ex: GearSubject): LoadKind {
  if (ex.category === "STRETCHING") return "NONE";
  return entryOf(ex).load;
}

/**
 * The gear that keeps the user from doing the exercise: all of its options,
 * when every one is in `missing`, plus any required piece that is — empty
 * when it can be done.
 */
export function blockingGear(ex: GearSubject, missing: readonly string[] | ReadonlySet<string>): GearId[] {
  const { gear, requires } = entryOf(ex);
  const has = (id: string) => (missing instanceof Set ? missing.has(id) : (missing as readonly string[]).includes(id));
  const out = gear.length > 0 && gear.every(has) ? [...gear] : [];
  for (const id of requires) if (has(id) && !out.includes(id)) out.push(id);
  return out;
}

/**
 * The apparatus to name for an exercise in the user's gym: its first option the
 * gym has ("Crossover / polia" for a pulldown when the pulldown station is
 * missing), else its first one. Null when it needs nothing.
 */
export function availableGearName(ex: GearSubject, missing: readonly string[] | ReadonlySet<string> = []): string | null {
  const gear = exerciseGear(ex);
  if (gear.length === 0) return null;
  const has = (id: string) => (missing instanceof Set ? missing.has(id) : (missing as readonly string[]).includes(id));
  return gearName(gear.find((id) => !has(id)) ?? gear[0]);
}

/**
 * Done only on gear the gym can't say it lacks (an odd machine, a strongman
 * implement): never offered as a stand-in, since nothing would ever take it
 * back out of the list.
 */
export function onUnlistedGearOnly(ex: GearSubject): boolean {
  const gear = exerciseGear(ex);
  return gear.length > 0 && gear.every((id) => BY_ID.get(id)?.listed === false);
}

/** True when the user's gym has some gear the exercise can be done on. */
export function isDoable(ex: GearSubject, missing: readonly string[] | ReadonlySet<string>): boolean {
  return blockingGear(ex, missing).length === 0;
}

/** Only known, listed ids, deduplicated, in catalog order — what Settings stores. */
export function normalizeMissingGear(ids: readonly string[]): GearId[] {
  const set = new Set(ids);
  return GEAR.filter((x) => x.listed && set.has(x.id)).map((x) => x.id);
}
