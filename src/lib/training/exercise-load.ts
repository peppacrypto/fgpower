/**
 * One exercise's load grid, resolved for the user: its own step ("Este
 * aparelho sobe de…"), else the program row's step (builder), else the gym's
 * settings for its kind of equipment (Settings → Minha academia). Pure — the
 * workout page, the summary and the history page all resolve it the same way.
 */
import { loadKindOf, type GearSubject } from "@/lib/exercises/gear";
import {
  DEFAULT_GYM_LOADS,
  DUMBBELL_SCHEMES,
  extendedRepCap,
  loadGridFor,
  type DumbbellScheme,
  type GymLoadSettings,
  type LoadGrid,
} from "./load-grid";

/** The Profile columns behind GymLoadSettings (a Prisma `select`). */
export const GYM_LOADS_SELECT = {
  dumbbellScheme: true,
  stackStepKg: true,
  cableStepKg: true,
  smallestPlateKg: true,
  kettlebellStepKg: true,
} as const;

type GymLoadRow = {
  dumbbellScheme?: string | null;
  stackStepKg?: number | null;
  cableStepKg?: number | null;
  smallestPlateKg?: number | null;
  kettlebellStepKg?: number | null;
};

const positive = (n: number | null | undefined, fallback: number) => (typeof n === "number" && n > 0 && Number.isFinite(n) ? n : fallback);

/** The gym's settings from a Profile row; anything missing or invalid reads as the default gym. */
export function gymLoadsOf(row: GymLoadRow | null | undefined): GymLoadSettings {
  const d = DEFAULT_GYM_LOADS;
  const scheme = (DUMBBELL_SCHEMES as readonly string[]).includes(row?.dumbbellScheme ?? "")
    ? (row?.dumbbellScheme as DumbbellScheme)
    : d.dumbbellScheme;
  return {
    dumbbellScheme: scheme,
    stackStepKg: positive(row?.stackStepKg, d.stackStepKg),
    cableStepKg: positive(row?.cableStepKg, d.cableStepKg),
    smallestPlateKg: positive(row?.smallestPlateKg, d.smallestPlateKg),
    kettlebellStepKg: positive(row?.kettlebellStepKg, d.kettlebellStepKg),
  };
}

/** The exercise's grid: its own step, then the program row's, then the gym's. */
export function exerciseLoadGrid(
  ex: GearSubject,
  gym: GymLoadSettings,
  own: { exerciseStepKg?: number | null; programStepKg?: number | null } = {},
): LoadGrid {
  const kind = loadKindOf(ex);
  if (own.exerciseStepKg != null && own.exerciseStepKg > 0) {
    return loadGridFor(kind, gym, { stepKg: own.exerciseStepKg, source: "exercise" });
  }
  if (own.programStepKg != null && own.programStepKg > 0) {
    return loadGridFor(kind, gym, { stepKg: own.programStepKg, source: "program" });
  }
  return loadGridFor(kind, gym);
}

/** How far the exercise's range may stretch before a coarse jump (P18). */
export function exerciseRepCap(repMax: number, ex: { movementPatternId?: string | null }): number {
  return extendedRepCap(repMax, ex.movementPatternId ?? null);
}
