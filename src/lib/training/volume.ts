import { isLoadedCarry, isTimedHold } from "./set-plan";

export interface VolumeSet {
  weightKg: number | null;
  reps: number | null;
  setType: "WARMUP" | "WORKING" | "DROP" | "FAILURE";
  isCompleted: boolean;
  /**
   * The exercise behind the set, when known: used to drop loaded carries (reps =
   * steps/metres) and timed holds (reps = seconds) from the kg-volume and rep
   * totals, where load × "reps" is meaningless (A-056). Absent → counted.
   */
  exercise?: { slug: string | null; notes: string | null };
}

/** The set's "reps" are real repetitions (not a carry's steps/metres or a hold's seconds). */
function countsAsReps(s: VolumeSet): boolean {
  if (!s.exercise) return true;
  return !isTimedHold(s.exercise) && !isLoadedCarry(s.exercise);
}

/**
 * Total working-set volume load (kg), Σ(weight × reps). Warm-ups excluded, and
 * loaded carries / timed holds excluded (their "reps" are steps or seconds, not
 * repetitions) (A-056).
 */
export function sessionVolumeKg(sets: VolumeSet[]): number {
  return round1(
    sets
      .filter((s) => s.isCompleted && s.setType !== "WARMUP" && s.weightKg != null && s.reps != null && countsAsReps(s))
      .reduce((sum, s) => sum + (s.weightKg as number) * (s.reps as number), 0),
  );
}

export function workingSetCount(sets: VolumeSet[]): number {
  return sets.filter((s) => s.isCompleted && s.setType !== "WARMUP").length;
}

export function totalReps(sets: VolumeSet[]): number {
  return sets
    .filter((s) => s.isCompleted && s.setType !== "WARMUP" && s.reps != null && countsAsReps(s))
    .reduce((sum, s) => sum + (s.reps as number), 0);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
