import { formatKg } from "@/lib/utils/format";
import { planWeek, weekdayFromName } from "@/lib/training/day-rotation";
import { wallClock } from "@/lib/training/week";

export { weekdayFromName };

/**
 * Pure pieces of the workout summary ("dossiê do treino"): how each exercise
 * compares with last time, where the week stands and what comes next, and the
 * São Paulo calendar dates it prints. Kept free of the database so they can be
 * unit-tested; summary-data.ts feeds them.
 */

// ---------------------------------------------------------------------------
// Vs. last time
// ---------------------------------------------------------------------------

export interface LiteSet {
  weightKg: number | null;
  reps: number | null;
  isExtra?: boolean;
}

/** Sets done with the top load, now and last time — when they differ. */
export interface SetCountChange {
  now: number;
  before: number;
}

export type LastTimeDelta =
  | { kind: "first" }
  | { kind: "load"; direction: "up" | "down"; deltaKg: number }
  | { kind: "reps"; direction: "up" | "down"; deltaReps: number; sets: SetCountChange | null }
  | { kind: "sets"; direction: "up" | "down"; sets: SetCountChange }
  | { kind: "same" };

const EPS = 1e-6;

/** Sets that count for a comparison: done with load and reps; the prescribed ones when there are any (extras are bonus). */
export function comparableSets<T extends LiteSet>(sets: T[]): (T & { weightKg: number; reps: number })[] {
  const usable = sets.filter(
    (s): s is T & { weightKg: number; reps: number } => s.weightKg != null && s.reps != null && s.reps >= 1,
  );
  const main = usable.filter((s) => !s.isExtra);
  return main.length > 0 ? main : usable;
}

/**
 * This session vs. the previous time the exercise was done: the top load
 * first (↑/↓ carga); at the same top load, the reps of the sets done with it,
 * set by set over the sets both times have (3×12 after 3×10 is +6; 30×12
 * after 30×10,10 is +2 — never a "decline" of 8 for one set left out). A
 * different number of sets at that load is said as such ("1 de 2 séries",
 * "+1 série") instead of folding into the reps. No previous time: first.
 */
export function compareWithLast(now: LiteSet[], prev: LiteSet[] | null): LastTimeDelta {
  const before = prev ? comparableSets(prev) : [];
  const after = comparableSets(now);
  if (before.length === 0) return { kind: "first" };
  if (after.length === 0) return { kind: "same" };
  const topBefore = Math.max(...before.map((s) => s.weightKg));
  const topAfter = Math.max(...after.map((s) => s.weightKg));
  if (Math.abs(topAfter - topBefore) > EPS) {
    return {
      kind: "load",
      direction: topAfter > topBefore ? "up" : "down",
      deltaKg: Math.round(Math.abs(topAfter - topBefore) * 100) / 100,
    };
  }
  const repsAt = (sets: { weightKg: number; reps: number }[], top: number) =>
    sets.filter((s) => Math.abs(s.weightKg - top) < EPS).map((s) => s.reps);
  const a = repsAt(after, topAfter);
  const b = repsAt(before, topBefore);
  const paired = Math.min(a.length, b.length);
  let diff = 0;
  for (let i = 0; i < paired; i++) diff += a[i] - b[i];
  const sets = a.length !== b.length ? { now: a.length, before: b.length } : null;
  if (diff !== 0) return { kind: "reps", direction: diff > 0 ? "up" : "down", deltaReps: Math.abs(diff), sets };
  if (sets) return { kind: "sets", direction: sets.now > sets.before ? "up" : "down", sets };
  return { kind: "same" };
}

/** Sets as compact text, consecutive sets at one load grouped: "60 kg × 12, 12 · 62,5 kg × 8". */
export function setsText(sets: LiteSet[]): string {
  const groups: { weightKg: number; reps: number[] }[] = [];
  for (const s of comparableSets(sets)) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(last.weightKg - s.weightKg) < EPS) last.reps.push(s.reps);
    else groups.push({ weightKg: s.weightKg, reps: [s.reps] });
  }
  return groups.map((g) => `${formatKg(g.weightKg)} × ${g.reps.join(", ")}`).join(" · ");
}

// ---------------------------------------------------------------------------
// The week and the next workout (Today's rule: lib/training/day-rotation)
// ---------------------------------------------------------------------------

export interface PlanDay {
  id: string;
  dayIndex: number;
  name: string;
  exerciseCount: number;
  /** Planned weekday (0 = Sunday), when the program sets one. */
  weekday: number | null;
  estimatedMinutes: number | null;
}

export interface SuggestedDate {
  dayNo: number;
  isToday: boolean;
  isTomorrow: boolean;
}

export interface NextWorkout<D extends PlanDay> {
  /** What Today will offer on `date` (if nothing else is trained before it). */
  day: D | null;
  date: SuggestedDate | null;
  /**
   * When there's no day to promise only because every day with exercises is
   * left open (a workout not finished), how many: Today offers none until
   * those are saved or discarded in their own rows. 0 otherwise.
   */
  openDaysBlocking: number;
  /** This week: all its workouts are done. */
  weekComplete: boolean;
  weeklyDone: number;
  weeklyTarget: number;
}

/**
 * This week's meter and the next workout — the day Today's hero will offer on
 * the suggested date. The day comes from Today's rotation (planWeek); its date
 * from suggestNextDate. When that date falls in a later week, Today will have
 * started a new week by then (nothing done yet: a plan laid out by weekday
 * from its first day, any other plan from its pointer), so the day is picked
 * again that way and dated in that week — a Saturday finisher of "Quarta"
 * is told "Segunda · seg", never a "Sexta" Today won't show on Monday; one of
 * "Sessão A" is told "Sessão B · seg", the day Today shows right away too.
 * Days of workouts still open are skipped: by any later date they are left
 * open, and Today leaves them to their own row.
 */
export function nextWorkout<D extends PlanDay>(p: {
  days: D[];
  nextDayIndex: number | null;
  daysPerWeek: number;
  doneDayIds: ReadonlySet<string> | ReadonlyMap<string, unknown>;
  /** Finished workouts of this program this week (with at least one working set). */
  sessionCount: number;
  /** Days of this program with a workout in progress. */
  openDayIds: ReadonlySet<string>;
  finishedAt: Date;
  now: Date;
  preferredDays: number[];
}): NextWorkout<D> {
  const rotation = {
    days: p.days,
    isTrainable: (d: D) => d.exerciseCount > 0,
    nextDayIndex: p.nextDayIndex,
    daysPerWeek: p.daysPerWeek,
    skipDayIds: p.openDayIds,
  };
  const week = planWeek({ ...rotation, doneDayIds: p.doneDayIds, sessionCount: p.sessionCount });
  const meter = { weekComplete: week.weekComplete, weeklyDone: week.weeklyDone, weeklyTarget: week.weeklyTarget };
  const dateFor = (day: D, nextWeek: boolean) =>
    suggestNextDate({
      finishedAt: p.finishedAt,
      now: p.now,
      plannedWeekday: day.weekday,
      namedWeekday: weekdayFromName(day.name),
      preferredDays: p.preferredDays,
      daysPerWeek: p.daysPerWeek,
      nextWeek,
    });

  if (week.nextDay) {
    const date = dateFor(week.nextDay, false);
    if (weekNumber(date.dayNo) === weekNumber(spDayNumber(p.now))) {
      return { ...meter, day: week.nextDay, date, openDaysBlocking: 0 };
    }
  }
  const fresh = planWeek({ ...rotation, doneDayIds: new Set<string>(), sessionCount: 0 }).nextDay;
  if (fresh) return { ...meter, day: fresh, date: dateFor(fresh, true), openDaysBlocking: 0 };
  return {
    ...meter,
    day: null,
    date: null,
    openDaysBlocking: p.days.filter((d) => rotation.isTrainable(d) && p.openDayIds.has(d.id)).length,
  };
}

// ---------------------------------------------------------------------------
// São Paulo calendar days
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** The São Paulo calendar day of `date` as a day number (days since 1970-01-01). */
export function spDayNumber(date: Date): number {
  const w = wallClock(date);
  return Math.floor(Date.UTC(w.year, w.month - 1, w.day) / DAY_MS);
}

/** Weekday (0 = Sunday) of a day number. */
export function weekdayOf(dayNo: number): number {
  return (((dayNo + 4) % 7) + 7) % 7; // 1970-01-01 was a Thursday
}

/** "sex 25 set" — styled as mono micro-caps where it's shown. */
export function formatDayNumber(dayNo: number): string {
  const d = new Date(dayNo * DAY_MS);
  return `${WEEKDAYS[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]}`;
}

/** "sex 25 set" for an instant, on the São Paulo wall clock. */
export function formatSpShortDate(date: Date): string {
  return formatDayNumber(spDayNumber(date));
}

/**
 * The date to suggest for the next workout: never before tomorrow (relative to
 * the finished workout) nor before today; next week's Monday or later when
 * the day is next week's. Then the day's planned weekday, else the next of the
 * user's preferred weekdays, else the weekday the day is named after
 * ("Sexta — Pernas"), else a rest gap that fits the weekly frequency
 * (3×/week → every other day) — also into next week: a Sunday finisher at
 * 3×/week is sent to Tuesday, not straight to Monday.
 */
export function suggestNextDate(p: {
  finishedAt: Date;
  now: Date;
  plannedWeekday: number | null;
  preferredDays: number[];
  /** The weekday in the day's name (weekdayFromName), when there is one. */
  namedWeekday?: number | null;
  daysPerWeek: number;
  nextWeek: boolean;
}): SuggestedDate {
  const today = spDayNumber(p.now);
  const done = spDayNumber(p.finishedAt);
  let earliest = Math.max(done + 1, today);
  if (p.nextWeek) earliest = Math.max(earliest, today - ((weekdayOf(today) + 6) % 7) + 7);

  const isWeekday = (d: number | null | undefined): d is number => d != null && Number.isInteger(d) && d >= 0 && d <= 6;
  const preferred = p.preferredDays.filter(isWeekday);
  const wanted = isWeekday(p.plannedWeekday)
    ? [p.plannedWeekday]
    : preferred.length > 0
      ? preferred
      : isWeekday(p.namedWeekday)
        ? [p.namedWeekday]
        : [];
  let dayNo: number;
  if (wanted.length > 0) {
    dayNo = earliest;
    while (!wanted.includes(weekdayOf(dayNo))) dayNo += 1;
  } else {
    const gap = Math.max(1, Math.floor(7 / Math.max(1, p.daysPerWeek)));
    dayNo = Math.max(earliest, done + gap);
  }
  return { dayNo, isToday: dayNo === today, isTomorrow: dayNo === today + 1 };
}

/** Monday-start week number of a day number (same weeks as Today's counter). */
function weekNumber(dayNo: number): number {
  return Math.floor((dayNo + 3) / 7); // 1969-12-29, day −3, was a Monday
}

/**
 * Weeks in a row with at least one finished workout, counted back from this
 * week — or from last week while this one has none yet (the week isn't over,
 * the streak isn't broken).
 */
export function weekStreak(workoutDays: number[], today: number): number {
  const weeks = new Set(workoutDays.map(weekNumber));
  let week = weekNumber(today);
  if (!weeks.has(week)) week -= 1;
  let streak = 0;
  while (weeks.has(week)) {
    streak += 1;
    week -= 1;
  }
  return streak;
}
