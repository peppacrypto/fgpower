/**
 * Trimming a generated day to the time the user said they have. The only
 * genuinely new logic in the onboarding auto-enroll: pure, deterministic and
 * tested in isolation. It never touches the main lifts and never drops an
 * exercise — it only shaves trailing accessory sets, and only when the day's
 * rough estimate runs over the session budget.
 *
 * The time model is a plain heuristic (it does not need to be exact — the
 * decision is relative: "is this day over budget, and by how many sets?"):
 * per exercise, a fixed setup cost, each warm-up set, and each working set as
 * its reps' time under tension plus the rest after it. The curated templates
 * already target their own session length and the recommender penalises a plan
 * longer than the user's budget, so in practice this only nudges the few
 * adaptable/home picks that land a little long.
 */

/** A working rep, controlled (concentric + eccentric). */
const SECONDS_PER_REP = 4;
/** A warm-up set plus its short rest (ramp-up, lighter and quick). */
const WARMUP_SET_SECONDS = 50;
/** Per-exercise setup/teardown: finding the station, loading, putting away. */
const TRANSITION_SECONDS = 45;
/** No exercise is trimmed below this many working sets — a plan with one set isn't a plan. */
export const MIN_WORKING_SETS = 2;

export interface FitExercise {
  /** Stable identity, so a caller can map a trim back to its row. */
  id: string;
  /** Working sets (what trimming lowers). */
  sets: number;
  /** Top of the rep range — the per-set work estimate uses it as an upper bound. */
  repMax: number;
  /** Rest after each working set, in seconds. */
  restSeconds: number;
  /** Warm-up sets, counted at a flat rate (never trimmed). */
  warmupSets: number;
  /** A main lift (Mechanics COMPOUND): preserved whole, never trimmed. */
  isCompound: boolean;
}

/** Seconds a single exercise takes at a given working-set count. */
function exerciseSeconds(ex: FitExercise, sets: number): number {
  return (
    TRANSITION_SECONDS +
    ex.warmupSets * WARMUP_SET_SECONDS +
    sets * (Math.max(0, ex.repMax) * SECONDS_PER_REP + Math.max(0, ex.restSeconds))
  );
}

/** Rough minutes a day of these exercises takes, at the sets each one carries. */
export function estimateDayMinutes(exercises: readonly FitExercise[]): number {
  const seconds = exercises.reduce((total, ex) => total + exerciseSeconds(ex, ex.sets), 0);
  return Math.round(seconds / 60);
}

export interface SessionFitResult {
  /** New working-set count per exercise id — only the ones that changed. */
  trims: Map<string, number>;
  estBeforeMinutes: number;
  estAfterMinutes: number;
}

/**
 * Shaves trailing accessory sets until the day fits `targetMinutes`, or until
 * nothing more can be trimmed without touching a main lift or going below
 * `MIN_WORKING_SETS`. Accessories at the END of the day lose a set first (the
 * finishers), then the ones before them. Compounds are never touched. Pure:
 * returns the set counts to apply, computes nothing against the database.
 *
 * `targetMinutes <= 0` or a day already within budget trims nothing.
 */
export function trimToSessionMinutes(
  exercises: readonly FitExercise[],
  targetMinutes: number,
  opts: { minWorkingSets?: number } = {},
): SessionFitResult {
  const minSets = Math.max(1, opts.minWorkingSets ?? MIN_WORKING_SETS);
  const estBeforeMinutes = estimateDayMinutes(exercises);
  // Current set count per exercise, mutated as we trim.
  const sets = new Map(exercises.map((ex) => [ex.id, ex.sets]));
  const secondsNow = () =>
    exercises.reduce((total, ex) => total + exerciseSeconds(ex, sets.get(ex.id) ?? ex.sets), 0);

  if (targetMinutes > 0) {
    const target = targetMinutes * 60;
    // Trim the last eligible accessory first; drain it to the floor, then move back.
    let guard = 0;
    const maxSteps = exercises.reduce((n, ex) => n + Math.max(0, ex.sets - minSets), 0);
    while (secondsNow() > target && guard++ < maxSteps + 1) {
      let trimmed = false;
      for (let i = exercises.length - 1; i >= 0; i--) {
        const ex = exercises[i];
        if (ex.isCompound) continue;
        const current = sets.get(ex.id) ?? ex.sets;
        if (current > minSets) {
          sets.set(ex.id, current - 1);
          trimmed = true;
          break;
        }
      }
      if (!trimmed) break; // nothing left to shave
    }
  }

  const trims = new Map<string, number>();
  for (const ex of exercises) {
    const now = sets.get(ex.id) ?? ex.sets;
    if (now !== ex.sets) trims.set(ex.id, now);
  }
  return {
    trims,
    estBeforeMinutes,
    estAfterMinutes: Math.round(secondsNow() / 60),
  };
}
