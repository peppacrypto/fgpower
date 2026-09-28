import { z } from "zod";

/**
 * Settings → Durante o treino (lib/actions/preferences.ts). A plain module:
 * a 'use server' file may only export async functions.
 */
export const workoutPreferencesSchema = z.object({ restTimerSound: z.boolean() }).strict();

export type WorkoutPreferences = z.infer<typeof workoutPreferencesSchema>;
