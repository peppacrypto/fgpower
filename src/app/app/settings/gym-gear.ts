/**
 * Settings → Minha academia → Aparelhos, the server half: the gear a user can
 * mark, grouped as a Brazilian gym-goer looks for it, and the plan's
 * exercises that the gym's missing gear leaves undoable (lib/exercises/gear
 * blockingGear). Pure, but kept off the client: it reads the curated gear map,
 * which only the server needs — the checklist gets plain groups.
 */
import { GEAR, GEAR_GROUP_LABEL, blockingGear, type GearGroup, type GearSubject } from "@/lib/exercises/gear";
import { joinPt } from "@/lib/programming/equipment-needs";

export interface GearChecklistGroup {
  id: GearGroup;
  label: string;
  items: { id: string; name: string }[];
}

/**
 * Every gear Settings lists (not the catch-alls), by group in the order of
 * GEAR_GROUP_LABEL and in catalog order within one — the order the missing
 * list is stored in (normalizeMissingGear).
 */
export function gearChecklistGroups(): GearChecklistGroup[] {
  return (Object.keys(GEAR_GROUP_LABEL) as GearGroup[])
    .map((group) => ({
      id: group,
      label: GEAR_GROUP_LABEL[group],
      items: GEAR.filter((g) => g.listed && g.group === group).map((g) => ({ id: g.id, name: g.namePt })),
    }))
    .filter((group) => group.items.length > 0);
}

/**
 * The plan's exercises the gym can't do — every gear they can be done on is
 * in `missing` — each once, in the order the plan first prescribes them
 * (an exercise on two days counts once: "Seu plano usa N exercícios…").
 */
export function blockedPlanExercises<T extends GearSubject & { id: string }>(exercises: readonly T[], missing: readonly string[]): T[] {
  if (missing.length === 0) return [];
  const lacking = new Set(missing);
  const seen = new Set<string>();
  const blocked: T[] = [];
  for (const ex of exercises) {
    if (seen.has(ex.id)) continue;
    seen.add(ex.id);
    if (blockingGear(ex, lacking).length > 0) blocked.push(ex);
  }
  return blocked;
}

/** "Agachamento Hack e Leg Press"; past `max` names, "A, B, C e mais 2" — the notice stays one line or two. */
export function blockedNamesText(names: readonly string[], max = 3): string {
  if (names.length <= max) return joinPt([...names]);
  return joinPt([...names.slice(0, max), `mais ${names.length - max}`]);
}
