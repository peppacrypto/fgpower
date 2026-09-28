import { weekdayFromName } from "@/lib/training/day-rotation";

/**
 * The week a program is laid out on: which weekdays (0 = Sunday … 6 =
 * Saturday) its days fall on. Written onto UserProgramDay.weekday when a
 * program is activated, from the days the user said they train
 * (Profile.preferredDays) — so Today can say "Descanso hoje — próximo: Sessão
 * B na segunda" and the summary can date the next workout. Pure: no I/O.
 *
 * - A plan whose days are named after weekdays ("Segunda — Superior") keeps
 *   those weekdays: its spacing (rest on Wednesday, say) is part of its design.
 * - Any other plan that trains each day once a week takes its days, in order,
 *   onto the user's weekdays — trimmed to a well-spaced subset when they
 *   picked more days than the plan has, filled in with well-spaced extra
 *   days when they picked fewer, and a conventional spread when they picked
 *   none (3× → seg · qua · sex).
 * - A plan that repeats its days within the week (A/B at 3×) has no fixed
 *   weekday per day: A falls on Monday one week and on Wednesday the next.
 *   Its days get none; `schedule` still says which weekdays it's trained on.
 */

const isWeekday = (d: unknown): d is number => typeof d === "number" && Number.isInteger(d) && d >= 0 && d <= 6;

/** Monday-first position of a weekday (Monday 0 … Sunday 6): the week as users in Brazil read it. */
export const mondayPos = (weekday: number) => (weekday + 6) % 7;

/** Weekdays sorted Monday-first. */
export function sortMondayFirst(weekdays: readonly number[]): number[] {
  return [...new Set(weekdays.filter(isWeekday))].sort((a, b) => mondayPos(a) - mondayPos(b));
}

/** The spread used when the user picked no days (weekends off while the week has room). */
export const DEFAULT_WEEKDAYS: Record<number, number[]> = {
  1: [1],
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
  7: [1, 2, 3, 4, 5, 6, 0],
};

/** How well a set of Monday-first positions spreads over the week (higher is better, compared in order). */
function spreadScore(positions: number[]): number[] {
  const sorted = [...positions].sort((a, b) => a - b);
  const n = sorted.length;
  const gaps = sorted.map((p, i) => (i === n - 1 ? sorted[0] + 7 - p : sorted[i + 1] - p));
  // Longest run of back-to-back days, around the week (Sunday → Monday is back to back too).
  let longestRun = n === 7 ? 7 : 0;
  if (n < 7) {
    const start = gaps.findIndex((g) => g > 1); // a day that ends a run
    let run = 0;
    for (let k = 1; k <= n; k++) {
      const i = (start + k) % n;
      run += 1;
      if (gaps[i] > 1) {
        longestRun = Math.max(longestRun, run);
        run = 0;
      }
    }
  }
  const weekend = sorted.filter((p) => p >= 5).length; // Saturday (5) and Sunday (6)
  const leximin = [...gaps].sort((a, b) => a - b);
  // Earliest in the week wins a full tie (Monday first).
  const earliness = sorted.map((p) => -p);
  return [Math.min(...gaps), -longestRun, -weekend, ...leximin, ...earliness];
}

function better(a: number[], b: number[]): boolean {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

/**
 * `count` weekdays to train on, Monday-first, built from the user's preferred
 * days: all of them when they match the count, the best-spaced subset when
 * there are more, the best-spaced additions when there are fewer, and
 * DEFAULT_WEEKDAYS when there are none.
 */
export function trainingWeekdays(count: number, preferredDays: readonly number[]): number[] {
  const n = Math.max(1, Math.min(7, Math.round(count) || 1));
  const preferred = sortMondayFirst(preferredDays);
  if (preferred.length === 0) return DEFAULT_WEEKDAYS[n];
  if (preferred.length === n) return preferred;

  const wanted = new Set(preferred.map(mondayPos));
  let best: { positions: number[]; score: number[] } | null = null;
  for (let mask = 0; mask < 128; mask++) {
    const positions = [0, 1, 2, 3, 4, 5, 6].filter((p) => mask & (1 << p));
    if (positions.length !== n) continue;
    const fits =
      preferred.length > n
        ? positions.every((p) => wanted.has(p)) // a subset of what they picked
        : [...wanted].every((p) => positions.includes(p)); // everything they picked, plus days
    if (!fits) continue;
    const score = spreadScore(positions);
    if (!best || better(score, best.score)) best = { positions, score };
  }
  return (best?.positions ?? []).map((p) => (p + 1) % 7);
}

export interface WeekLayout {
  /** Per program day (same order as given), its weekday — null for a plan that repeats its days. */
  weekdays: (number | null)[];
  /** The weekdays the plan is trained on, Monday-first. */
  schedule: number[];
}

/**
 * Lays a program's days (in dayIndex order) out on the week for someone who
 * trains on `preferredDays`. See the module comment for the rules.
 */
export function layOutWeek(days: readonly { name: string }[], daysPerWeek: number, preferredDays: readonly number[]): WeekLayout {
  const frequency = Math.max(1, Math.min(7, daysPerWeek));
  const none = { weekdays: days.map(() => null), schedule: trainingWeekdays(frequency, preferredDays) };
  if (days.length === 0 || daysPerWeek > days.length || days.length > 7) return none;

  const named = days.map((d) => weekdayFromName(d.name));
  if (named.every(isWeekday) && new Set(named).size === named.length) {
    return { weekdays: named, schedule: sortMondayFirst(named) };
  }
  const schedule = trainingWeekdays(days.length, preferredDays);
  return { weekdays: days.map((_, i) => schedule[i] ?? null), schedule };
}
