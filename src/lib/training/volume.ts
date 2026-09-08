export interface VolumeSet {
  weightKg: number | null;
  reps: number | null;
  setType: "WARMUP" | "WORKING" | "DROP" | "FAILURE";
  isCompleted: boolean;
}

/** Total working-set volume load (kg), Σ(weight × reps). Warm-ups excluded. */
export function sessionVolumeKg(sets: VolumeSet[]): number {
  return round1(
    sets
      .filter((s) => s.isCompleted && s.setType !== "WARMUP" && s.weightKg != null && s.reps != null)
      .reduce((sum, s) => sum + (s.weightKg as number) * (s.reps as number), 0),
  );
}

export function workingSetCount(sets: VolumeSet[]): number {
  return sets.filter((s) => s.isCompleted && s.setType !== "WARMUP").length;
}

export function totalReps(sets: VolumeSet[]): number {
  return sets
    .filter((s) => s.isCompleted && s.setType !== "WARMUP" && s.reps != null)
    .reduce((sum, s) => sum + (s.reps as number), 0);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
