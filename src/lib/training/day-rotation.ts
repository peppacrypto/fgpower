import { normalizeText } from "@/lib/utils/normalize-text";

/**
 * Which program day comes next this week, and where the week stands. Today's
 * hero and week meter and the workout summary's "Próximo treino" all read the
 * rotation through this one rule, so the summary never promises a day Today
 * won't offer.
 *
 * - The next day is the first one not yet trained this week, walking the days
 *   from the program's pointer (the day after the last one trained).
 * - A plan that prescribes more sessions a week than it has days (A/B at
 *   3×/week) keeps offering the pointer day once every day is done, until the
 *   weekly frequency is met.
 * - A plan laid out by weekday (a day with a planned weekday, or named after
 *   one: "Segunda — Superior") that doesn't repeat days starts each
 *   Monday-start week over from its first day, even if last week ended early:
 *   Monday's workout belongs on Monday.
 * - Every other plan carries its pointer from week to week: a Saturday
 *   finisher of "Sessão A" is offered "Sessão B" on Saturday and on Monday
 *   alike, never "Sessão A" twice in a row.
 * - Days without exercises are never suggested (they'd open a blank workout),
 *   nor are days left open on an earlier date (their own row saves, continues
 *   or discards them — suggesting them again would start a second copy).
 *
 * Whether the plan repeats days is the server's rule (advanceProgram counts
 * every day, empty or not), so the rotation and the pointer agree.
 */

export interface RotationDay {
  id: string;
  dayIndex: number;
  /** The day's name ("Segunda — Superior"): a leading weekday lays the plan out by weekday. */
  name?: string;
  /** Planned weekday (0 = Sunday), when the program sets one. */
  weekday?: number | null;
}

/** A Set or Map of day ids. */
interface IdLookup {
  has(id: string): boolean;
  readonly size: number;
}

export interface WeekPlan<D extends RotationDay> {
  /** The day to train next this week; null once the week is done (or only days left open remain). */
  nextDay: D | null;
  /** Every trainable day (and repeat) of the week is done and nothing is left open. */
  weekComplete: boolean;
  /** Sessions counted toward the week: distinct days, plus repeats only where the plan repeats days. */
  weeklyDone: number;
  weeklyTarget: number;
}

/** True when the plan prescribes more sessions a week than it has days (A/B at 3×/week). */
export function repeatsDays(daysPerWeek: number, dayCount: number): boolean {
  return daysPerWeek > dayCount;
}

const isWeekday = (d: number | null | undefined): d is number => d != null && Number.isInteger(d) && d >= 0 && d <= 6;

/** True when a day of the plan has a planned weekday or is named after one ("Segunda — Superior"). */
export function laidOutByWeekday(days: readonly RotationDay[]): boolean {
  return days.some((d) => isWeekday(d.weekday) || (d.name != null && weekdayFromName(d.name) != null));
}

/**
 * Whether a new week (nothing done yet) starts over from the plan's first day
 * instead of the program's pointer: a plan laid out by weekday that doesn't
 * repeat days.
 */
export function restartsEachWeek(days: readonly RotationDay[], daysPerWeek: number): boolean {
  return !repeatsDays(daysPerWeek, days.length) && laidOutByWeekday(days);
}

export function planWeek<D extends RotationDay>(p: {
  /** The program's days, in dayIndex order. */
  days: D[];
  /** Whether a day can be started (it has exercises). */
  isTrainable: (day: D) => boolean;
  /** The program's pointer: the dayIndex of the day after the last one trained. */
  nextDayIndex: number | null | undefined;
  daysPerWeek: number;
  /** Days trained this week (finished workouts with at least one working set). */
  doneDayIds: IdLookup;
  /** Finished workouts of this program this week (with at least one working set). */
  sessionCount: number;
  /** Days with a workout left open on an earlier date: never suggested. */
  skipDayIds?: IdLookup;
}): WeekPlan<D> {
  const { days, isTrainable, doneDayIds, sessionCount } = p;
  const skip = p.skipDayIds ?? new Set<string>();
  const trainable = days.filter(isTrainable);
  const repeats = repeatsDays(p.daysPerWeek, days.length);
  const pointer =
    sessionCount === 0 && restartsEachWeek(days, p.daysPerWeek)
      ? 0
      : Math.max(0, days.findIndex((d) => d.dayIndex === p.nextDayIndex));
  const rotation = days.map((_, i) => days[(pointer + i) % days.length]).filter(isTrainable);
  // A plan that doesn't repeat days is done once each trainable day is: an
  // emptied day neither counts toward the week nor gets repeated in its place.
  const weeklyTarget = repeats ? Math.max(trainable.length, p.daysPerWeek) : trainable.length;
  const suggestable = rotation.filter((d) => !skip.has(d.id));
  const nextDay =
    suggestable.find((d) => !doneDayIds.has(d.id)) ?? (sessionCount < weeklyTarget ? suggestable[0] : undefined) ?? null;
  // Capped: a day trained this week and emptied since still shows as done in its row.
  const weeklyDone = Math.min(
    weeklyTarget,
    doneDayIds.size + Math.max(0, Math.min(sessionCount - doneDayIds.size, weeklyTarget - trainable.length)),
  );
  return {
    nextDay,
    weekComplete: trainable.length > 0 && !nextDay && skip.size === 0,
    weeklyDone,
    weeklyTarget,
  };
}

const NAME_WEEKDAY: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
};

/**
 * The weekday a day is named after — "Sexta — Pernas" → 5 — for programs that
 * name their days by weekday without setting one. Null when the name doesn't
 * start with a weekday.
 */
export function weekdayFromName(name: string): number | null {
  const first = normalizeText(name.trim()).match(/^[a-z]+/)?.[0];
  return first != null && first in NAME_WEEKDAY ? NAME_WEEKDAY[first] : null;
}
