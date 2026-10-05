import { repeatsDays } from "./day-rotation";

/**
 * A finished workout's frozen week plan — the program's weekly frequency and
 * its trainable/total day counts as they were when the workout counted
 * (stamped by advanceProgram). The weekly streak and a block's "N de M
 * treinos" read it for past weeks, so editing the program later (add or
 * duplicate a day, raise the frequency, remove or empty a day) never rewrites
 * a week the user already trained under a different structure — only the edit
 * week onward follows the new plan. Null on a row means "read the live
 * program": the current week, and old rows the backfill froze to their
 * program's structure at the time (spec A-001).
 */
export interface WeekTargetSnapshot {
  daysPerWeek: number;
  /** Days with at least one exercise. */
  trainableDays: number;
  /** Days the program has (trainable or not): whether it repeats days. */
  dayCount: number;
}

/** The target a program sets for a full week: its trainable days, or the frequency when it repeats days (planWeek's rule). */
export function weekTargetOf(daysPerWeek: number, trainableDays: number, dayCount: number): number {
  if (trainableDays === 0) return Math.max(1, daysPerWeek);
  return repeatsDays(daysPerWeek, dayCount) ? Math.max(trainableDays, daysPerWeek) : trainableDays;
}

/** Reads a stored snapshot (WorkoutSession.weekTargetSnapshot JSON); null when absent or malformed. */
export function parseWeekTargetSnapshot(json: unknown): WeekTargetSnapshot | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null);
  const daysPerWeek = n(o.daysPerWeek);
  const trainableDays = n(o.trainableDays);
  const dayCount = n(o.dayCount);
  if (daysPerWeek == null || trainableDays == null || dayCount == null) return null;
  return { daysPerWeek, trainableDays, dayCount };
}
