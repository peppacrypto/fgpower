import { daysLeftInWeek } from "@/lib/training/week-guidance";

/**
 * Whether Today's "Faltam N treinos para manter a sequência" can be said: the
 * count must fit the days left at the plan's spacing (3×/week trains every
 * other day) and never ask for more than 2 — a number that takes back-to-back
 * sessions to reach would push cramming to save a streak (W-131).
 */
export function nudgeFits(remaining: number, daysLeft: number, perWeek: number): boolean {
  const gap = Math.max(1, Math.floor(7 / Math.max(1, perWeek)));
  return remaining > 0 && remaining <= Math.min(2, Math.ceil(daysLeft / gap));
}

/**
 * The days a workout can still go in this week: today's too, unless a
 * workout was already done today — a trained Sunday leaves none, so no
 * "falta 1" is ever asked of it (a second session the same day).
 */
export function nudgeDaysLeft(now: Date, trainedToday: boolean): number {
  return Math.max(0, daysLeftInWeek(now) - (trainedToday ? 1 : 0));
}
