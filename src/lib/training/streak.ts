/**
 * Weekly streak — never a daily one (training days are spread on purpose; a
 * rest day must never "break" anything). A week counts when the user met its
 * target, or trained at all in a deload week. One missed week is forgiven per
 * 8 weeks of streak, so a sick week or a trip doesn't wipe months of work. A
 * program's short entry week (activated Thursday–Sunday) is neutral: met, it
 * counts; short of its target, it neither adds to the run nor breaks it.
 * Pure: callers build the week list (São Paulo Monday-start weeks).
 */

export interface StreakWeek {
  /** Sessions finished that week reached the week's target. */
  met: boolean;
  /** A planned deload week (lighter on purpose): any training counts. */
  deload?: boolean;
  /** At least one finished workout that week. */
  trained?: boolean;
  /**
   * A week that can't break the run: a program's Thursday–Sunday entry week
   * (it doesn't count toward the program either). Met, it counts as any week;
   * short of its target, it's skipped — never a miss.
   */
  neutral?: boolean;
}

export interface StreakResult {
  /** Consecutive counted weeks up to the latest finished week (or this week, once it's met). */
  current: number;
  /** Longest run in the given history. */
  best: number;
  /** Forgiven weeks used inside the current run. */
  freeWeeksUsed: number;
}

/** Weeks of streak that earn one forgiven miss. */
export const WEEKS_PER_FREE_WEEK = 8;

/** The week counts toward the streak: its target met, or a deload week with any workout. */
export function weekCounts(w: StreakWeek): boolean {
  return w.met || (w.deload === true && w.trained === true);
}

/**
 * `weeks` oldest → newest, all of them complete weeks; `thisWeek` is the week
 * in progress: it extends the streak once met, and never breaks it while open.
 */
export function weeklyStreak(weeks: StreakWeek[], thisWeek?: StreakWeek): StreakResult {
  let current = 0;
  let best = 0;
  let freeUsed = 0;
  let pendingMiss = false; // a miss we may forgive if the streak continues

  for (const w of weeks) {
    // A neutral week short of its target: as if it weren't there.
    if (w.neutral === true && !weekCounts(w)) continue;
    if (weekCounts(w)) {
      if (pendingMiss) pendingMiss = false;
      current += 1;
    } else if (current > 0 && !pendingMiss && Math.floor(current / WEEKS_PER_FREE_WEEK) > freeUsed) {
      // Forgive this miss: the run survives, the week itself doesn't add.
      freeUsed += 1;
      pendingMiss = true;
    } else {
      current = 0;
      freeUsed = 0;
      pendingMiss = false;
    }
    best = Math.max(best, current);
  }

  if (thisWeek && weekCounts(thisWeek)) {
    current += 1;
    best = Math.max(best, current);
  }
  return { current, best, freeWeeksUsed: freeUsed };
}
