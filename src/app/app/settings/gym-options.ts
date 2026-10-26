/**
 * Pure helpers behind Settings → Minha academia's two client blocks: the words
 * for each "Pesos" choice and the example under it, the values the form starts
 * from, and the "Aparelhos" list after a tap. Client-safe: it reads only the
 * load grid (lib/training/load-grid) and the pt-BR formatters — never the gear
 * map or zod, which stay on the server (gym-gear.ts, lib/validation/gym).
 */
import {
  CABLE_STEP_OPTIONS,
  DEFAULT_GYM_LOADS,
  DUMBBELL_SCHEMES,
  KETTLEBELL_STEP_OPTIONS,
  PLATE_OPTIONS,
  STACK_STEP_OPTIONS,
  loadGridFor,
  nextLoadUp,
  type DumbbellScheme,
  type GymLoadSettings,
  type LoadKind,
} from "@/lib/training/load-grid";
import { formatKg, formatNumber } from "@/lib/utils/format";

/** How a rack is spaced, in the words of the chip that picks it. */
export const DUMBBELL_SCHEME_LABEL: Record<DumbbellScheme, string> = {
  "1-10-2": "1 em 1 até 10 kg, depois 2 em 2",
  "1": "1 em 1",
  "2": "2 em 2",
  "2.5": "2,5 em 2,5",
};

/**
 * Dumbbells the example starts from: on the rack of that spacing (8 isn't a
 * 2,5 kg dumbbell), and on both sides of the switch for the mixed rack.
 */
const DUMBBELL_SAMPLES: Record<DumbbellScheme, number[]> = {
  "1-10-2": [8, 12],
  "1": [12],
  "2": [12],
  "2.5": [12.5],
};

/** A kilo amount as a chip says it ("2,5"), and as a screen reader should ("2,5 quilos"; singular below 2). */
export function kgChip(v: number): { value: number; label: string; srLabel: string } {
  const label = formatNumber(v, 2);
  return { value: v, label, srLabel: `${label} ${v < 2 ? "quilo" : "quilos"}` };
}

/**
 * "12 → 14 kg": where a load of `kind` goes next from `fromKg` at these
 * settings — read off the same grid the suggestions follow, so the example
 * can't promise a jump the workout won't make.
 */
export function stepExample(kind: LoadKind, gym: GymLoadSettings, fromKg: number): string {
  const to = nextLoadUp(loadGridFor(kind, gym), fromKg);
  return to === null ? "" : `${formatNumber(fromKg, 2)} → ${formatKg(to)}`;
}

/** The example line under each "Pesos" choice, for the settings on screen. */
export function gymExamples(gym: GymLoadSettings): Record<keyof GymLoadSettings, string> {
  const dumbbells = (DUMBBELL_SAMPLES[gym.dumbbellScheme] ?? [12]).map((kg) => stepExample("DUMBBELL", gym, kg));
  return {
    dumbbellScheme: `Ex.: ${dumbbells.join("; ")}.`,
    stackStepKg: `Ex.: ${stepExample("STACK", gym, 40)}.`,
    cableStepKg: `Ex.: ${stepExample("CABLE", gym, 20)}.`,
    // A bar takes a pair of the lightest plates, a T-bar one (lib/training/load-grid).
    smallestPlateKg: `Ex.: barra ${stepExample("BARBELL", gym, 60)}; cavalinho ${stepExample("PLATE_ONE_SIDE", gym, 30)}.`,
    kettlebellStepKg: `Ex.: ${stepExample("KETTLEBELL", gym, 12)}.`,
  };
}

const isOffered = (options: readonly number[], v: number) => options.some((o) => Math.abs(o - v) < 1e-9);
const offeredOr = (options: readonly number[], v: number, fallback: number) => (isOffered(options, v) ? v : fallback);

/**
 * The values the form starts from: each one among the chips it offers, the
 * default gym's otherwise. The block is saved whole and the server takes
 * only offered values (lib/validation/gym), so a value written some other
 * way would make every later tap fail; it reads as the default instead, as
 * gymLoadsOf already reads a missing one.
 */
export function gymLoadsForForm(gym: GymLoadSettings): GymLoadSettings {
  const d = DEFAULT_GYM_LOADS;
  return {
    dumbbellScheme: (DUMBBELL_SCHEMES as readonly string[]).includes(gym.dumbbellScheme) ? gym.dumbbellScheme : d.dumbbellScheme,
    stackStepKg: offeredOr(STACK_STEP_OPTIONS, gym.stackStepKg, d.stackStepKg),
    cableStepKg: offeredOr(CABLE_STEP_OPTIONS, gym.cableStepKg, d.cableStepKg),
    smallestPlateKg: offeredOr(PLATE_OPTIONS, gym.smallestPlateKg, d.smallestPlateKg),
    kettlebellStepKg: offeredOr(KETTLEBELL_STEP_OPTIONS, gym.kettlebellStepKg, d.kettlebellStepKg),
  };
}

/**
 * The gym's missing list after it gains (`has`) or loses `ids`: each id once,
 * in `order` (the checklist's, which is the catalog's — the order
 * setMissingGear stores), anything outside the checklist left out as the
 * server would.
 */
export function withGear(missing: readonly string[], ids: readonly string[], has: boolean, order: readonly string[]): string[] {
  const set = new Set(missing);
  for (const id of ids) {
    if (has) set.delete(id);
    else set.add(id);
  }
  return order.filter((id) => set.has(id));
}

/** "Tem todos" / "Falta 1" / "Faltam 3" — the head of the list and of each group. */
export function missingCountText(n: number): string {
  if (n <= 0) return "Tem todos";
  return n === 1 ? "Falta 1" : `Faltam ${formatNumber(n, 0)}`;
}
