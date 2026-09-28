import { formatKg } from "@/lib/utils/format";
import { weekdayFromName } from "@/lib/training/day-rotation";
import { wallClock } from "@/lib/training/week";

export { weekdayFromName };

/**
 * Pure pieces of the workout summary ("dossiê do treino"): how each exercise
 * compares with last time, and the São Paulo calendar dates it prints. What
 * comes next is Today's own rule (day-rotation upcomingWorkout, in
 * summary-data.ts). Kept free of the database so they can be unit-tested.
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
