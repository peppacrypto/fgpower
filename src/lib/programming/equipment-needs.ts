/**
 * What a program's exercises ask for, in words: the dossier's "Requer:
 * máquinas, cabos" line, and which of it a user without a full gym is
 * missing ("Adaptar para halteres"). Pure — the equipment a user can use
 * comes in as a list (lib/data/alternatives EQUIPMENT_FOR_ACCESS).
 */
import { EQUIPMENT_NEED_LABEL } from "@/lib/constants/program-labels";

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
