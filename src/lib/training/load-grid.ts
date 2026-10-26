/**
 * The loads an exercise can actually be done with — "Pesos da sua academia".
 *
 * A dumbbell rack has fixed weights (1 kg apart up to 10 kg, then 2 kg in most
 * Brazilian gyms), a pin-loaded machine moves one plate of its stack at a
 * time (5 kg), a cable stack the same, a barbell or a leg press takes a pair of
 * the smallest plates, a T-bar or a belt a single one. "Add 2,5 kg" to all of
 * them suggested loads that don't exist (a 14,5 kg dumbbell, 42,5 kg on a 5 kg
 * stack). The progression (next-load), the warm-ups and the ease-back after a
 * break all move along this grid instead.
 *
 * Pure and serializable: a LoadGrid is plain data, built on the server from
 * the user's gym settings and handed to the workout screen as is.
 */

/** How load is added on an exercise's equipment (lib/exercises/gear loadKindOf). */
export type LoadKind =
  /** Fixed-weight dumbbells; the logged kg is one dumbbell. */
  | "DUMBBELL"
  /** Fixed-weight kettlebells. */
  | "KETTLEBELL"
  /** Plates on both ends of a bar: barbell, EZ bar, trap bar, Smith. */
  | "BARBELL"
  /** Plate-loaded machine with plates on both sides (leg press, hack, lever presses). */
  | "PLATE_MACHINE"
  /** One plate sleeve: landmine/T-bar, lying T-bar ("cavalinho"), belt, a plate in the hands, sled. */
  | "PLATE_ONE_SIDE"
  /** Selectorized machine: a pin in a weight stack. */
  | "STACK"
  /** Pulley + weight stack. */
  | "CABLE"
  /** Medicine balls and other light fixed implements. */
  | "FIXED_LIGHT"
  /** The body's own weight; kg is optional extra load (a plate on a belt, a dumbbell held). */
  | "BODYWEIGHT"
  /** Never progressed in kg: bands, cardio machines, rollers, balls. */
  | "NONE";

/** How the gym's dumbbell rack is spaced. */
export const DUMBBELL_SCHEMES = ["1-10-2", "1", "2", "2.5"] as const;
export type DumbbellScheme = (typeof DUMBBELL_SCHEMES)[number];

/** The user's gym, as Settings → Minha academia stores it (Profile). */
export interface GymLoadSettings {
  dumbbellScheme: DumbbellScheme;
  /** One plate of a pin-loaded machine's stack. */
  stackStepKg: number;
  /** One plate of a cable stack. */
  cableStepKg: number;
  /** The lightest plate there is (a bar takes a pair, a T-bar or a belt one). */
  smallestPlateKg: number;
  /** The gap between kettlebells. */
  kettlebellStepKg: number;
}

/**
 * The most common Brazilian commercial gym: dumbbells 1 kg apart up to 10 kg
 * and 2 kg apart after, 5 kg stacks on machines and cables, 2,5 kg as the
 * lightest plate (present in every gym; smaller ones are a choice in Settings)
 * and competition-spaced kettlebells.
 */
export const DEFAULT_GYM_LOADS: GymLoadSettings = {
  dumbbellScheme: "1-10-2",
  stackStepKg: 5,
  cableStepKg: 5,
  smallestPlateKg: 2.5,
  kettlebellStepKg: 4,
};

/** Every option Settings offers, per setting (the validation reads the same lists). */
export const STACK_STEP_OPTIONS = [2.5, 5, 7.5, 10] as const;
export const CABLE_STEP_OPTIONS = [2.5, 5, 7.5, 10] as const;
export const PLATE_OPTIONS = [0.5, 1, 1.25, 2, 2.5, 5] as const;
export const KETTLEBELL_STEP_OPTIONS = [2, 4] as const;
/** An exercise's own step ("Este aparelho sobe de…"). */
export const EXERCISE_STEP_OPTIONS = [0.5, 1, 1.25, 2, 2.5, 4, 5, 7.5, 10, 20] as const;

export interface LoadGrid {
  kind: LoadKind;
  /**
   * The additive step (stack, cable, plates, an exercise's own step), or 0 for
   * a ladder / a load that never moves in kg.
   */
  stepKg: number;
  /** Fixed implements (dumbbells, kettlebells, balls): every weight there is, ascending. */
  ladder: number[] | null;
  /** Where the step came from: the exercise's own, the program row's, or the gym's settings. */
  source: "exercise" | "program" | "gym";
}

const EPS = 1e-6;
/** The heaviest dumbbell / kettlebell a ladder lists; past it, the last gap repeats. */
const LADDER_TOP_KG = 100;

const r2 = (n: number) => Math.round(n * 100) / 100;

function arithmeticLadder(start: number, step: number, top = LADDER_TOP_KG): number[] {
  const out: number[] = [];
  for (let i = 0; ; i++) {
    const kg = r2(start + i * step);
    if (kg > top + EPS) break;
    out.push(kg);
  }
  return out;
}

/** The dumbbells a rack of that spacing holds. */
export function dumbbellLadder(scheme: DumbbellScheme): number[] {
  switch (scheme) {
    case "1":
      return arithmeticLadder(1, 1);
    case "2":
      return arithmeticLadder(2, 2);
    case "2.5":
      return arithmeticLadder(2.5, 2.5);
    case "1-10-2":
    default:
      return [...arithmeticLadder(1, 1, 10), ...arithmeticLadder(12, 2)];
  }
}

/** Medicine balls: 1 kg apart to 10 kg, then 2 kg. */
const FIXED_LIGHT_LADDER = [...arithmeticLadder(1, 1, 10), ...arithmeticLadder(12, 2, 30)];

/**
 * The grid for one exercise. `overrideStepKg` is the exercise's own step
 * (Este aparelho sobe de…, or the program builder's per-exercise step): on a
 * fixed implement it re-spaces the ladder (2,5 kg dumbbells), elsewhere it is
 * the additive step — and on a kind never loaded in kg it makes it loadable
 * (the user said this thing goes up in kg).
 */
export function loadGridFor(
  kind: LoadKind,
  gym: GymLoadSettings,
  override?: { stepKg: number | null | undefined; source: "exercise" | "program" } | null,
): LoadGrid {
  const own = override && override.stepKg != null && override.stepKg > 0 ? override : null;
  if (own) {
    const stepKg = own.stepKg as number;
    if (kind === "DUMBBELL" || kind === "KETTLEBELL" || kind === "FIXED_LIGHT") {
      return { kind, stepKg: 0, ladder: arithmeticLadder(stepKg, stepKg), source: own.source };
    }
    return { kind, stepKg, ladder: null, source: own.source };
  }
  switch (kind) {
    case "DUMBBELL":
      return { kind, stepKg: 0, ladder: dumbbellLadder(gym.dumbbellScheme), source: "gym" };
    case "KETTLEBELL":
      return { kind, stepKg: 0, ladder: arithmeticLadder(4, gym.kettlebellStepKg), source: "gym" };
    case "FIXED_LIGHT":
      return { kind, stepKg: 0, ladder: FIXED_LIGHT_LADDER, source: "gym" };
    case "BARBELL":
    case "PLATE_MACHINE":
      return { kind, stepKg: r2(2 * gym.smallestPlateKg), ladder: null, source: "gym" };
    case "PLATE_ONE_SIDE":
    case "BODYWEIGHT":
      return { kind, stepKg: gym.smallestPlateKg, ladder: null, source: "gym" };
    case "STACK":
      return { kind, stepKg: gym.stackStepKg, ladder: null, source: "gym" };
    case "CABLE":
      return { kind, stepKg: gym.cableStepKg, ladder: null, source: "gym" };
    case "NONE":
    default:
      return { kind: "NONE", stepKg: 0, ladder: null, source: "gym" };
  }
}

/** A grid that only adds `stepKg` — what a bare step (tests, legacy callers) means. */
export function additiveGrid(stepKg: number, kind: LoadKind = "BARBELL"): LoadGrid {
  return { kind, stepKg: stepKg > 0 ? stepKg : 2.5, ladder: null, source: "gym" };
}

/** True when the grid can move a load at all (not bands, cardio, rollers). */
export function isLoadable(grid: LoadGrid): boolean {
  return grid.ladder !== null || grid.stepKg > 0;
}

/**
 * The next load there is above `kg`: the next dumbbell on the rack (12 → 14,
 * 9 → 10, an off-rack 14,5 → 16), one more plate of the stack (40 → 45), one
 * more pair of plates on the bar. Null when the grid never moves in kg.
 */
export function nextLoadUp(grid: LoadGrid, kg: number): number | null {
  if (grid.ladder) {
    const up = grid.ladder.find((w) => w > kg + EPS);
    if (up !== undefined) return up;
    const n = grid.ladder.length;
    const gap = n >= 2 ? grid.ladder[n - 1] - grid.ladder[n - 2] : (grid.ladder[0] ?? 0);
    return gap > 0 ? r2(Math.max(kg, grid.ladder[n - 1] ?? 0) + gap) : null;
  }
  return grid.stepKg > 0 ? r2(kg + grid.stepKg) : null;
}

/** The load there is just below `kg` (the step back), or null when there is none above 0. */
export function nextLoadDown(grid: LoadGrid, kg: number): number | null {
  if (grid.ladder) {
    const below = grid.ladder.filter((w) => w < kg - EPS);
    return below.length > 0 ? below[below.length - 1] : null;
  }
  if (!(grid.stepKg > 0)) return null;
  const down = r2(kg - grid.stepKg);
  return down > EPS ? down : null;
}

/**
 * The heaviest load there is at or under `kg` — a warm-up at ~50% or the ~90%
 * after a break lands on a real dumbbell or a whole number of plates. Null
 * below the lightest one.
 */
export function snapLoadDown(grid: LoadGrid, kg: number): number | null {
  if (!(kg > 0)) return null;
  if (grid.ladder) {
    const under = grid.ladder.filter((w) => w <= kg + EPS);
    return under.length > 0 ? under[under.length - 1] : null;
  }
  if (!(grid.stepKg > 0)) return r2(kg);
  const snapped = r2(Math.floor((kg + EPS) / grid.stepKg) * grid.stepKg);
  return snapped > EPS ? snapped : null;
}

/** The load there is nearest to `kg` (a tie goes up, as Math.round does) — warm-ups, the ease-back. */
export function snapLoadNearest(grid: LoadGrid, kg: number): number | null {
  if (!(kg > 0)) return null;
  const down = snapLoadDown(grid, kg);
  if (down !== null && Math.abs(down - kg) < EPS) return down;
  const up = nextLoadUp(grid, down ?? 0);
  if (down === null) return up;
  if (up === null) return down;
  return up - kg <= kg - down + EPS ? up : down;
}

/** How big the jump to the next load is at `kg` (12 kg dumbbells → 2; a 5 kg stack → 5). */
export function stepAt(grid: LoadGrid, kg: number): number {
  const up = nextLoadUp(grid, kg);
  return up === null ? 0 : r2(up - kg);
}

const kgText = (n: number) => `${String(r2(n)).replace(".", ",")} kg`;

/** "halteres de 1 em 1 kg até 10 kg, depois de 2 em 2" — the grid in the user's words. */
export function describeGrid(grid: LoadGrid): string {
  if (grid.ladder) {
    const l = grid.ladder;
    const first = l.length >= 2 ? r2(l[1] - l[0]) : (l[0] ?? 0);
    const switchAt = l.findIndex((w, i) => i > 0 && Math.abs(r2(w - l[i - 1]) - first) > EPS);
    const what = grid.kind === "KETTLEBELL" ? "kettlebells" : grid.kind === "FIXED_LIGHT" ? "bolas" : "halteres";
    if (switchAt > 0) {
      const then = r2(l[switchAt] - l[switchAt - 1]);
      return `${what} de ${String(first).replace(".", ",")} em ${String(first).replace(".", ",")} kg até ${kgText(l[switchAt - 1])}, depois de ${String(then).replace(".", ",")} em ${String(then).replace(".", ",")}`;
    }
    return `${what} de ${String(first).replace(".", ",")} em ${String(first).replace(".", ",")} kg`;
  }
  if (!(grid.stepKg > 0)) return "sem carga em kg";
  return `sobe de ${kgText(grid.stepKg)} em ${kgText(grid.stepKg)}`;
}

// ---------------------------------------------------------------------------
// Reps at another load (P18 — coarse increments)
// ---------------------------------------------------------------------------

/**
 * Reps-to-failure ↔ load, Epley (lib/training/estimated-1rm): e1RM = w·(1 + RTF/30).
 * Only used to judge whether a jump fits the rep range — never shown as a 1RM.
 */
const EPLEY = 30;

/** Reps a set at `toKg` should give, at the same reps in reserve, after `reps` at `fromKg`. */
export function predictedRepsAt(toKg: number, fromKg: number, reps: number, rir: number): number {
  if (!(toKg > 0) || !(fromKg > 0)) return reps;
  const e1rm = fromKg * (1 + (reps + rir) / EPLEY);
  return EPLEY * (e1rm / toKg - 1) - rir;
}

/** Reps needed at `fromKg` for a set at `toKg` to reach `targetReps` at the same reps in reserve. */
export function repsNeededFor(toKg: number, fromKg: number, targetReps: number, rir: number): number {
  const e1rmNeeded = toKg * (1 + (targetReps + rir) / EPLEY);
  return Math.ceil(EPLEY * (e1rmNeeded / fromKg - 1) - rir - EPS);
}

/**
 * How far a rep range may stretch before a coarse jump (P18: "extend the
 * range to 20–25; 25–30 for calves and lateral raises"), never past about
 * twice the top of the prescribed range — a strength range isn't turned into
 * an endurance one to wait for a big plate.
 */
export function extendedRepCap(repMax: number, movementPatternId?: string | null): number {
  const ceiling = movementPatternId === "plantar-flexion" || movementPatternId === "shoulder-abduction" ? 30 : 25;
  return Math.max(repMax + 1, Math.min(ceiling, 2 * repMax + 2));
}
