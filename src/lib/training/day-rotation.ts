import { normalizeText } from "@/lib/utils/normalize-text";
import { wallClock } from "./week";

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
 * - A plan laid out by weekday (its days named after one: "Segunda —
 *   Superior") that doesn't repeat days starts each Monday-start week over
 *   from its first day — Monday's workout belongs on Monday — unless the user
 *   continues last week's sequence (weekStartChoice: the days left over from
 *   last week, "Continuar a sequência" vs "Recomeçar").
 * - Every other plan carries its pointer from week to week: a Saturday
 *   finisher of "Sessão A" is offered "Sessão B" on Saturday and on Monday
 *   alike, never "Sessão A" twice in a row.
 * - An entry week (a program started Thursday–Sunday) aims at what's left of
 *   the week: its target is capped at the days left.
 * - Days without exercises are never suggested (they'd open a blank workout),
 *   nor are days left open on an earlier date (their own row saves, continues
 *   or discards them — suggesting them again would start a second copy).
 *
 * A day's planned weekday (UserProgramDay.weekday, mapped onto the user's
 * preferred days at activation) is the user's calendar, not the program's
 * structure: it dates the next workout (upcomingWorkout) and draws Today's
 * week strip, but doesn't make a Sessão A/B/C rotation start over each week.
 *
 * Whether the plan repeats days is the server's rule (advanceProgram counts
 * every day, empty or not), so the rotation and the pointer agree.
 */

export interface RotationDay {
  id: string;
  dayIndex: number;
  /** The day's name ("Segunda — Superior"): a leading weekday lays the plan out by weekday. */
  name?: string;
  /** Planned weekday (0 = Sunday): when the user means to train this day. */
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

/**
 * True when a day of the plan is named after a weekday ("Segunda — Superior"):
 * the program itself is laid out by weekday. A planned weekday alone doesn't
 * count — it's the user's calendar (see the header).
 */
export function laidOutByWeekday(days: readonly RotationDay[]): boolean {
  return days.some((d) => d.name != null && weekdayFromName(d.name) != null);
}

/**
 * Whether a new week (nothing done yet) starts over from the plan's first day
 * instead of the program's pointer: a plan laid out by weekday that doesn't
 * repeat days.
 */
export function restartsEachWeek(days: readonly RotationDay[], daysPerWeek: number): boolean {
  return !repeatsDays(daysPerWeek, days.length) && laidOutByWeekday(days);
}

export interface PlanWeekInput<D extends RotationDay> {
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
  /**
   * An entry week (program-calendar isPartialEntryWeek, while it lasts): the
   * days left in it, today included. The week's target is capped at them, and
   * the week is complete once that many are done.
   */
  targetCap?: number | null;
  /**
   * A plan that starts each week over (restartsEachWeek) continues from its
   * pointer instead, at a week start: "Continuar a sequência" (weekStartChoice).
   */
  carryOver?: boolean;
}

export function planWeek<D extends RotationDay>(p: PlanWeekInput<D>): WeekPlan<D> {
  const { days, isTrainable, doneDayIds, sessionCount } = p;
  const skip = p.skipDayIds ?? new Set<string>();
  const trainable = days.filter(isTrainable);
  const repeats = repeatsDays(p.daysPerWeek, days.length);
  const pointer =
    sessionCount === 0 && restartsEachWeek(days, p.daysPerWeek) && !p.carryOver
      ? 0
      : Math.max(0, days.findIndex((d) => d.dayIndex === p.nextDayIndex));
  const rotation = days.map((_, i) => days[(pointer + i) % days.length]).filter(isTrainable);
  // A plan that doesn't repeat days is done once each trainable day is: an
  // emptied day neither counts toward the week nor gets repeated in its place.
  const planTarget = repeats ? Math.max(trainable.length, p.daysPerWeek) : trainable.length;
  const capped = p.targetCap != null && p.targetCap < planTarget;
  const weeklyTarget = capped ? Math.max(1, p.targetCap as number) : planTarget;
  const suggestable = rotation.filter((d) => !skip.has(d.id));
  // Capped: a day trained this week and emptied since still shows as done in its row.
  const weeklyDone = Math.min(
    weeklyTarget,
    doneDayIds.size + Math.max(0, Math.min(sessionCount - doneDayIds.size, planTarget - trainable.length)),
  );
  const nextDay =
    capped && weeklyDone >= weeklyTarget
      ? null
      : (suggestable.find((d) => !doneDayIds.has(d.id)) ??
        (sessionCount < planTarget ? suggestable[0] : undefined) ??
        null);
  return {
    nextDay,
    weekComplete: trainable.length > 0 && !nextDay && skip.size === 0,
    weeklyDone,
    weeklyTarget,
  };
}

// ---------------------------------------------------------------------------
// A new week after one that stopped mid-plan (W-089)
// ---------------------------------------------------------------------------

export interface WeekStartChoice<D> {
  /** Last week's days not done, in plan order ("Quinta — Puxar, Sexta — Pernas"). */
  leftover: D[];
  /**
   * What the week starts with unless the user picks. Continue the sequence
   * when starting over would repeat what was just trained — the plan's first
   * day was the last one done, or the last workout was the day before the
   * new week (a Sunday catch-up: Monday's day on Monday would make two in a
   * row) — and when the user's real frequency is below the plan's days (a
   * 3×/week user on a 5-day plan would otherwise never reach Quinta and
   * Sexta). Otherwise start over: after an entry week (a short week that
   * never meant to cover the plan), or when the user usually does the whole
   * plan (last week was a one-off).
   */
  byDefault: "continue" | "restart";
  /** Last week was the program's entry week (a Thursday–Sunday start). */
  afterEntryWeek: boolean;
}

/**
 * At a week start (nothing done yet this week), a plan that starts each week
 * over whose last week stopped mid-plan — an entry week with a workout
 * included: which days were left, and whether to continue from them by
 * default. Null otherwise — after a week with no workout at all (a break:
 * the week starts over), or when continuing and starting over are the same
 * day.
 */
export function weekStartChoice<D extends RotationDay>(p: {
  days: D[];
  isTrainable: (day: D) => boolean;
  nextDayIndex: number | null | undefined;
  daysPerWeek: number;
  /** Finished workouts of this program this week. */
  sessionCount: number;
  /** Last calendar week, for this enrollment. */
  lastWeek: {
    doneDayIds: IdLookup;
    sessionCount: number;
    entry: boolean;
    /** The day of last week's latest workout (its program day), if known. */
    lastDayId?: string | null;
    /** When last week's latest workout was done (dayNumberOf), if known. */
    lastDoneNo?: number | null;
  } | null;
  /** The new week's Monday (a day number): with lastDoneNo, whether the week follows a workout the day before. */
  mondayNo?: number | null;
  /**
   * Distinct days trained in each of the enrollment's recent complete weeks
   * that had a workout (entry week excluded), newest first — the user's real
   * frequency. Empty: judged by last week alone.
   */
  recentWeeklyDays?: number[];
}): WeekStartChoice<D> | null {
  const { days, lastWeek } = p;
  if (p.sessionCount > 0 || !lastWeek || lastWeek.sessionCount === 0) return null;
  if (!restartsEachWeek(days, p.daysPerWeek)) return null;
  const trainable = days.filter(p.isTrainable);
  const pointer = days.find((d) => d.dayIndex === p.nextDayIndex);
  if (!pointer || !p.isTrainable(pointer) || pointer.id === trainable[0]?.id) return null;
  const leftover = trainable.filter((d) => !lastWeek.doneDayIds.has(d.id));
  if (leftover.length === 0) return null;
  const afterEntryWeek = lastWeek.entry;

  // Starting over would put the same session, or any, right after the last one.
  const firstDayJustDone = lastWeek.lastDayId != null && lastWeek.lastDayId === trainable[0]?.id;
  const dayBefore = lastWeek.lastDoneNo != null && p.mondayNo != null && p.mondayNo - lastWeek.lastDoneNo <= 1;
  if (firstDayJustDone || dayBefore) return { leftover, byDefault: "continue", afterEntryWeek };
  if (afterEntryWeek) return { leftover, byDefault: "restart", afterEntryWeek };

  const recent = (p.recentWeeklyDays ?? []).slice(0, 4);
  const sample = recent.length > 0 ? recent : [lastWeek.doneDayIds.size];
  const sorted = [...sample].sort((a, b) => a - b);
  const median = sorted[Math.floor((sorted.length - 1) / 2)];
  return { leftover, byDefault: median < trainable.length ? "continue" : "restart", afterEntryWeek };
}

// ---------------------------------------------------------------------------
// The calendar: when the next workout is suggested (Today's hero and rest day)
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

/** The São Paulo calendar day of `date` as a day number (days since 1970-01-01). */
export function dayNumberOf(date: Date): number {
  const w = wallClock(date);
  return Math.floor(Date.UTC(w.year, w.month - 1, w.day) / DAY_MS);
}

/** Weekday (0 = Sunday) of a day number. */
export function weekdayOfDayNo(dayNo: number): number {
  return (((dayNo + 4) % 7) + 7) % 7; // 1970-01-01 was a Thursday
}

/** The Monday of the week containing a day number. */
export function mondayOf(dayNo: number): number {
  return dayNo - ((weekdayOfDayNo(dayNo) + 6) % 7);
}

/**
 * The weekdays the user trains on, for the calendar: the program days'
 * planned weekdays (written at activation), else the profile's preferred
 * days, else the weekdays the days are named after. Empty: no schedule — the
 * next workout is then spaced by the weekly frequency.
 */
export function plannedWeekdays(days: readonly RotationDay[], preferredDays: readonly number[] = []): Set<number> {
  const planned = days.map((d) => d.weekday).filter(isWeekday);
  if (planned.length > 0) return new Set(planned);
  const preferred = preferredDays.filter(isWeekday);
  if (preferred.length > 0) return new Set(preferred);
  return new Set(days.map((d) => (d.name != null ? weekdayFromName(d.name) : null)).filter(isWeekday));
}

export interface SuggestedWorkout<D> {
  day: D;
  /** São Paulo day number it is suggested for. */
  dayNo: number;
  isToday: boolean;
  isTomorrow: boolean;
  /** It's next week's first workout (the week is done, or no planned day is left in this one). */
  nextWeek: boolean;
}

export interface Upcoming<D extends RotationDay> {
  week: WeekPlan<D>;
  /** The next workout and the day it's suggested for; null while only days left open remain. */
  next: SuggestedWorkout<D> | null;
  /** Nothing is suggested for today: a workout was finished today, or today is a planned rest day with the week on track. */
  restToday: boolean;
}

/**
 * The next workout and when — what Today's hero shows, and what the summary
 * promises right after a workout (lastDoneNo = today). The day always comes
 * from planWeek (this week) or, when the week has no planned day left for it,
 * from next week's start (planWeek with nothing done), so a date never names
 * a day Today won't offer then.
 *
 * - Entry week: today, or tomorrow once today's is done — every day left counts.
 * - With a schedule (plannedWeekdays): today when it's a planned day, or when
 *   too few planned days are left this week for the sessions still to do
 *   (catching up — never after a workout already done today); otherwise the
 *   next planned day this week, and today is a rest day.
 * - Without one: today; after a workout today, spaced by the weekly
 *   frequency (3×/week → every other day).
 * - Next week: its first planned day (without a schedule: Monday, spaced as
 *   above — a Sunday finisher at 3×/week is sent to Tuesday).
 */
export function upcomingWorkout<D extends RotationDay>(
  p: PlanWeekInput<D> & {
    /** Today, as a São Paulo day number (dayNumberOf). */
    todayNo: number;
    /** The day of the user's latest finished workout (any program), if any. */
    lastDoneNo: number | null;
    preferredDays: readonly number[];
    /** Next week's start continues this week's sequence (weekStartChoice's default for it). */
    carryOverNextWeek?: boolean;
  },
): Upcoming<D> {
  const week = planWeek(p);
  const todayNo = p.todayNo;
  const trainable = p.days.filter(p.isTrainable);
  const planned = plannedWeekdays(trainable, p.preferredDays);
  const weekEnd = mondayOf(todayNo) + 6;
  const trainedToday = p.lastDoneNo === todayNo;
  const gap = Math.max(1, Math.floor(7 / Math.max(1, p.daysPerWeek)));
  const suggest = (day: D, dayNo: number, nextWeek: boolean): SuggestedWorkout<D> => ({
    day,
    dayNo,
    isToday: dayNo === todayNo,
    isTomorrow: dayNo === todayNo + 1,
    nextWeek,
  });

  if (week.nextDay) {
    let dayNo: number | null;
    if (p.targetCap != null) {
      dayNo = trainedToday ? todayNo + 1 : todayNo;
    } else if (planned.size === 0) {
      dayNo = trainedToday ? Math.max(todayNo + 1, (p.lastDoneNo ?? todayNo) + gap) : todayNo;
    } else {
      const from = trainedToday ? todayNo + 1 : todayNo;
      const plannedLeft: number[] = [];
      for (let d = from; d <= weekEnd; d++) if (planned.has(weekdayOfDayNo(d))) plannedLeft.push(d);
      const stillToDo = week.weeklyTarget - week.weeklyDone;
      const today = !trainedToday && (planned.has(weekdayOfDayNo(todayNo)) || plannedLeft.length < stillToDo);
      dayNo = today ? todayNo : (plannedLeft[0] ?? null);
    }
    if (dayNo != null && dayNo <= weekEnd) {
      return { week, next: suggest(week.nextDay, dayNo, false), restToday: dayNo !== todayNo };
    }
  } else if (!week.weekComplete) {
    // Only days left open remain: their own rows save or discard them first.
    return { week, next: null, restToday: false };
  }

  const fresh = planWeek({
    ...p,
    doneDayIds: new Set<string>(),
    sessionCount: 0,
    targetCap: null,
    carryOver: p.carryOverNextWeek ?? false,
  }).nextDay;
  if (!fresh) return { week, next: null, restToday: week.weekComplete };
  const monday = weekEnd + 1;
  let dayNo = monday;
  if (planned.size > 0) {
    while (!planned.has(weekdayOfDayNo(dayNo))) dayNo += 1;
  } else {
    dayNo = Math.max(monday, (p.lastDoneNo ?? todayNo) + gap);
  }
  return { week, next: suggest(fresh, dayNo, true), restToday: true };
}

export interface WeekStripCell {
  dayNo: number;
  weekday: number;
  /** A planned training day (plannedWeekdays). */
  planned: boolean;
  /** A workout was finished that day. */
  done: boolean;
  today: boolean;
  /** Before today. */
  past: boolean;
}

/**
 * Today's 7-cell week strip, Monday → Sunday: planned days, days trained,
 * today. Days before `fromNo` (a program started mid-week) aren't planned;
 * the day the next workout is suggested for (upcomingWorkout) always is — an
 * entry week or a catch-up trains on days the schedule doesn't name, and the
 * strip mustn't call today a rest day while the hero says to train.
 */
export function weekStrip(p: {
  todayNo: number;
  planned: Set<number>;
  doneDayNos: Iterable<number>;
  fromNo?: number | null;
  /** The day the next workout is suggested for, when it's this week. */
  suggestedNo?: number | null;
}): WeekStripCell[] {
  const done = new Set(p.doneDayNos);
  const monday = mondayOf(p.todayNo);
  return Array.from({ length: 7 }, (_, i) => {
    const dayNo = monday + i;
    const weekday = weekdayOfDayNo(dayNo);
    return {
      dayNo,
      weekday,
      planned: (p.planned.has(weekday) && dayNo >= (p.fromNo ?? -Infinity)) || dayNo === p.suggestedNo,
      done: done.has(dayNo),
      today: dayNo === p.todayNo,
      past: dayNo < p.todayNo,
    };
  });
}

const WEEKDAY_SHORT = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const WEEKDAY_LONG = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MONTH_SHORT = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

/** "SEG · 28 SET" — mono micro-caps. */
export function formatDayTag(dayNo: number): string {
  const d = new Date(dayNo * DAY_MS);
  return `${WEEKDAY_SHORT[d.getUTCDay()]} · ${String(d.getUTCDate()).padStart(2, "0")} ${MONTH_SHORT[d.getUTCMonth()]}`;
}

/** "hoje", "amanhã", "na segunda" (this week or next), "em 6 dias"… — how Today says when. */
export function whenText(dayNo: number, todayNo: number): string {
  const days = dayNo - todayNo;
  if (days <= 0) return "hoje";
  if (days === 1) return "amanhã";
  const weekday = weekdayOfDayNo(dayNo);
  // "na segunda"/"no sábado": within a week it names the day unambiguously.
  if (days < 7) return `${weekday === 0 || weekday === 6 ? "no" : "na"} ${WEEKDAY_LONG[weekday]}`;
  return `em ${days} dias`;
}

/** The weekday's pt-BR name ("segunda", "sábado"). */
export function weekdayName(weekday: number): string {
  return WEEKDAY_LONG[weekday] ?? "";
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
