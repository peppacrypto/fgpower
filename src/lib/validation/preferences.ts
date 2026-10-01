import { z } from "zod";

/**
 * Settings → Durante o treino (lib/actions/preferences.ts). A plain module:
 * a 'use server' file may only export async functions.
 */

/**
 * "Salto de carga" (W-149, decision 7 — kg only): how much the suggestion
 * goes up when it is time to add load ("↑ Suba para…") and the step of the
 * warm-up loads. An exercise's own increment, set in the program, wins
 * (decision D-G: UserProgramExercise.loadIncrementKg null = follow this).
 */
export const LOAD_INCREMENT_OPTIONS = [0.5, 1, 1.25, 2, 2.5, 5] as const;

/** A quarter-kilo grid: every plate step there is, and values stored before these options existed (0,75). */
const onQuarterKg = (v: number) => Math.abs(v * 4 - Math.round(v * 4)) < 1e-9;

export const workoutPreferencesSchema = z
  .object({
    restTimerSound: z.boolean(),
    hapticsEnabled: z.boolean(),
    loadIncrementKg: z.number().min(0.25).max(20).refine(onQuarterKg),
  })
  .strict();

export type WorkoutPreferences = z.infer<typeof workoutPreferencesSchema>;
