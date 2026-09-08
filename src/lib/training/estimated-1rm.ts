/**
 * Estimated one-repetition maximum (e1RM).
 *
 * IMPORTANT: this is always an ESTIMATE, never a "1RM". It is only
 * reasonably accurate in the ~1-10 rep range; beyond that the error grows
 * quickly (see docs/SCIENCE_METHOD.md). We deliberately refuse to estimate
 * from very high-rep sets.
 *
 * Formulas (both widely used and validated against measured 1RM in
 * resistance-trained lifters — see LeSuer et al. 1997, J Strength Cond Res):
 *   Epley (1985):   1RM = weight × (1 + reps / 30)
 *   Brzycki (1993): 1RM = weight × 36 / (37 - reps)
 *
 * We use Epley as the default (slightly more conservative at higher reps
 * and does not blow up as reps approaches 37), and expose Brzycki for
 * cross-checking / display.
 */

export const MAX_RELIABLE_REPS_FOR_1RM = 10;

export function estimate1RmEpley(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export function estimate1RmBrzycki(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  if (reps >= 37) return NaN; // formula breaks down / divides by zero
  return (weightKg * 36) / (37 - reps);
}

export interface Estimated1RmResult {
  /** null when the set is outside the range we consider reliable enough to show. */
  epleyKg: number | null;
  brzyckiKg: number | null;
  reliable: boolean;
}

/**
 * Returns null estimates (reliable: false) for sets with 0 reps/weight or
 * more than MAX_RELIABLE_REPS_FOR_1RM reps, rather than a misleading number.
 */
export function estimate1Rm(weightKg: number, reps: number): Estimated1RmResult {
  if (weightKg <= 0 || reps <= 0 || reps > MAX_RELIABLE_REPS_FOR_1RM) {
    return { epleyKg: null, brzyckiKg: null, reliable: false };
  }
  return {
    epleyKg: round1(estimate1RmEpley(weightKg, reps)),
    brzyckiKg: round1(estimate1RmBrzycki(weightKg, reps)),
    reliable: true,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
