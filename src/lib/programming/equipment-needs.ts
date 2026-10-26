/**
 * What a program's exercises ask for, in words: the dossier's "Requer:
 * máquinas, cabos" line, which of it a user without a full gym is missing
 * ("Adaptar para halteres"), and which apparatus their gym doesn't have
 * ("Sem aparelho: Hack", "Ajustar à minha academia"). Pure — the equipment a
 * user can use comes in as a list (lib/data/alternatives EQUIPMENT_FOR_ACCESS),
 * the gear their gym lacks as Profile.missingGear (lib/exercises/gear).
 */
import { EQUIPMENT_NEED_LABEL } from "@/lib/constants/program-labels";
import { GEAR, blockingGear, exerciseGear, gearName, type GearId, type GearSubject } from "@/lib/exercises/gear";

const ORDER = Object.keys(EQUIPMENT_NEED_LABEL);

/** Equipment ids that need something, deduplicated, in the "Requer:" order. */
export function neededEquipment(equipmentIds: (string | null | undefined)[]): string[] {
  const set = new Set(equipmentIds.filter((id): id is string => !!id && id in EQUIPMENT_NEED_LABEL));
  return ORDER.filter((id) => set.has(id));
}

/** "máquinas, cabos e barra" — a list read the way it is said. */
export function joinPt(words: string[]): string {
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} e ${words[words.length - 1]}`;
}

/** The nouns for a set of equipment ids ("máquinas", "cabos"), labels deduplicated. */
export function needLabels(equipmentIds: string[]): string[] {
  return [...new Set(neededEquipment(equipmentIds).map((id) => EQUIPMENT_NEED_LABEL[id]))];
}

/**
 * The equipment ids a program uses that a user can't: empty for a full gym
 * (`allowed` null) and for a program whose gear they have. Bodyweight and
 * "none" are never missing.
 */
export function missingEquipment(equipmentIds: (string | null | undefined)[], allowed: readonly string[] | null): string[] {
  if (allowed === null) return [];
  return neededEquipment(equipmentIds).filter((id) => !allowed.includes(id));
}

// ---------------------------------------------------------------------------
// The gym's apparatus (Settings → Minha academia → Aparelhos)
// ---------------------------------------------------------------------------

/** A template made the user's own without the gear their gym lacks (the dossier's "Adaptar" review). */
export const GYM_ADAPT_LABEL = "Adaptar à sua academia";
/** The user's own program, its rows swapped in place (/app/programs/[id]/academia). */
export const GYM_ADJUST_LABEL = "Ajustar à minha academia";

const GEAR_ORDER = new Map<string, number>(GEAR.map((g, i) => [g.id, i]));
const LISTED = new Set<string>(GEAR.filter((g) => g.listed).map((g) => g.id));

/** Gear ids deduplicated, in Settings' order (unknown ids last, as given). */
function inGearOrder(ids: Iterable<string>): string[] {
  const rank = (id: string) => GEAR_ORDER.get(id) ?? GEAR.length;
  return [...new Set(ids)].sort((a, b) => rank(a) - rank(b));
}

/**
 * The apparatus an exercise is named by ("Hack", "Halteres", "Remada baixa"):
 * the first of its options a user can mark in Settings. Null when it needs
 * nothing a gym could lack — or only a catch-all ("Outra máquina"), which
 * would say less than the catalog's own equipment name.
 */
export function gearLabelOf(ex: GearSubject): string | null {
  const first = exerciseGear(ex).find((id) => LISTED.has(id));
  return first ? gearName(first) : null;
}

/** "Hack e Mesa flexora": the gear's names as they are said, in Settings' order. */
export function gearListPt(ids: Iterable<string>): string {
  return joinPt(inGearOrder(ids).map(gearName));
}

/**
 * A program row's flag when the user's gym can't do its exercise: "Sem
 * aparelho: Hack" — or, for one that works on any of several (all missing),
 * "Sem aparelho: Remada baixa e Crossover / polia". `blocking` is
 * lib/exercises/gear blockingGear's answer; empty gives null (no flag).
 */
export function missingGearFlag(blocking: readonly string[]): string | null {
  return blocking.length > 0 ? `Sem aparelho: ${gearListPt(blocking)}` : null;
}

/** Every gear id that keeps the gym from one of these exercises, in Settings' order — the notice's "Sua academia não tem: …". */
export function gearBlockingAny(exercises: Iterable<GearSubject>, missing: readonly string[] | ReadonlySet<string>): GearId[] {
  const ids: GearId[] = [];
  for (const ex of exercises) ids.push(...blockingGear(ex, missing));
  return inGearOrder(ids) as GearId[];
}
