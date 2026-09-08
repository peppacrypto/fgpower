/**
 * Progressive overload engine (spec §43.4-43.5).
 *
 * Deterministic, transparent, and NEVER changes a load automatically — it
 * only suggests a next load and explains why, based on the user's actual
 * last performance against the prescribed rep range / RIR target. The user
 * always confirms.
 */

export type ProgressionStrategy = "DOUBLE" | "LINEAR_LOAD" | "REPETITION" | "RIR_BASED" | "MANUAL";

export interface PrescribedSet {
  repMin: number;
  repMax: number;
  rirTarget: number | null;
}

export interface PerformedSet {
  weightKg: number | null;
  reps: number | null;
  rir: number | null;
}

export interface ProgressionSuggestion {
  strategy: ProgressionStrategy;
  /** True when we recommend increasing the load next session. */
  progressionAvailable: boolean;
  /** Present only when progressionAvailable is true. */
  suggestedLoadKg: number | null;
  /** Short, honest, English explanation of *why* — shown to the user verbatim or translated in the UI. */
  reasonKey: ProgressionReasonKey;
  reasonData?: Record<string, number>;
}

export type ProgressionReasonKey =
  | "no-history"
  | "incomplete-sets"
  | "manual-strategy"
  | "below-rep-range"
  | "within-rep-range-add-reps"
  | "at-rep-range-ceiling-with-target-rir"
  | "rir-lower-than-target-keep-load"
  | "rir-higher-than-target-add-load"
  | "rir-at-target-keep-load"
  | "linear-hit-prescription"
  | "linear-missed-prescription";

function currentTopLoad(sets: PerformedSet[]): number {
  return Math.max(0, ...sets.map((s) => s.weightKg ?? 0));
}

function allSetsUsable(sets: PerformedSet[]): boolean {
  return sets.length > 0 && sets.every((s) => s.weightKg != null && s.reps != null);
}

export function suggestProgression(
  strategy: ProgressionStrategy,
  prescribed: PrescribedSet,
  lastSession: PerformedSet[],
  loadIncrementKg: number,
): ProgressionSuggestion {
  if (strategy === "MANUAL") {
    return { strategy, progressionAvailable: false, suggestedLoadKg: null, reasonKey: "manual-strategy" };
  }
  if (!allSetsUsable(lastSession)) {
    return { strategy, progressionAvailable: false, suggestedLoadKg: null, reasonKey: "no-history" };
  }

  const load = currentTopLoad(lastSession);

  switch (strategy) {
    case "DOUBLE":
      return suggestDouble(prescribed, lastSession, load, loadIncrementKg);
    case "LINEAR_LOAD":
      return suggestLinear(prescribed, lastSession, load, loadIncrementKg);
    case "REPETITION":
      // Load never changes; the UI encourages adding reps at the same load.
      return { strategy, progressionAvailable: false, suggestedLoadKg: null, reasonKey: "within-rep-range-add-reps" };
    case "RIR_BASED":
      return suggestRirBased(prescribed, lastSession, load, loadIncrementKg);
  }
}

function suggestDouble(
  prescribed: PrescribedSet,
  sets: PerformedSet[],
  load: number,
  increment: number,
): ProgressionSuggestion {
  const belowMin = sets.some((s) => (s.reps as number) < prescribed.repMin);
  if (belowMin) {
    return { strategy: "DOUBLE", progressionAvailable: false, suggestedLoadKg: null, reasonKey: "incomplete-sets" };
  }

  const allAtCeiling = sets.every((s) => (s.reps as number) >= prescribed.repMax);
  const rirTarget = prescribed.rirTarget;
  const rirOk = rirTarget == null || sets.every((s) => s.rir == null || s.rir >= rirTarget - 0.5);

  if (allAtCeiling && rirOk) {
    return {
      strategy: "DOUBLE",
      progressionAvailable: true,
      suggestedLoadKg: round(load + increment),
      reasonKey: "at-rep-range-ceiling-with-target-rir",
      reasonData: { repMax: prescribed.repMax },
    };
  }

  return {
    strategy: "DOUBLE",
    progressionAvailable: false,
    suggestedLoadKg: null,
    reasonKey: "within-rep-range-add-reps",
  };
}

function suggestLinear(
  prescribed: PrescribedSet,
  sets: PerformedSet[],
  load: number,
  increment: number,
): ProgressionSuggestion {
  const hitPrescription = sets.every((s) => (s.reps as number) >= prescribed.repMin);
  if (hitPrescription) {
    return {
      strategy: "LINEAR_LOAD",
      progressionAvailable: true,
      suggestedLoadKg: round(load + increment),
      reasonKey: "linear-hit-prescription",
    };
  }
  return {
    strategy: "LINEAR_LOAD",
    progressionAvailable: false,
    suggestedLoadKg: null,
    reasonKey: "linear-missed-prescription",
  };
}

function suggestRirBased(
  prescribed: PrescribedSet,
  sets: PerformedSet[],
  load: number,
  increment: number,
): ProgressionSuggestion {
  if (prescribed.rirTarget == null || sets.some((s) => s.rir == null)) {
    return { strategy: "RIR_BASED", progressionAvailable: false, suggestedLoadKg: null, reasonKey: "no-history" };
  }
  const targetRir = prescribed.rirTarget;
  const avgRir = sets.reduce((sum, s) => sum + (s.rir as number), 0) / sets.length;
  const delta = avgRir - targetRir;

  if (delta >= 1) {
    return {
      strategy: "RIR_BASED",
      progressionAvailable: true,
      suggestedLoadKg: round(load + increment),
      reasonKey: "rir-higher-than-target-add-load",
      reasonData: { avgRir: round(avgRir), targetRir },
    };
  }
  if (delta <= -1) {
    return {
      strategy: "RIR_BASED",
      progressionAvailable: false,
      suggestedLoadKg: null,
      reasonKey: "rir-lower-than-target-keep-load",
      reasonData: { avgRir: round(avgRir), targetRir },
    };
  }
  return {
    strategy: "RIR_BASED",
    progressionAvailable: false,
    suggestedLoadKg: null,
    reasonKey: "rir-at-target-keep-load",
    reasonData: { avgRir: round(avgRir), targetRir },
  };
}

function round(n: number): number {
  return Math.round(n * 20) / 20; // nearest 0.05kg to keep 2.5kg-plate math clean at *2 for barbells; UI rounds further to increment
}
