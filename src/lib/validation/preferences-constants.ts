/**
 * Zod-free half of Settings → Durante o treino, split out of `preferences.ts`
 * so the Settings client form imports the option list and the shape without
 * pulling zod (~88 KB gzip) into the route bundle (A-089). `preferences.ts`
 * holds the schema and a compile-time check that it still matches this type.
 */

/**
 * "Salto de carga" (W-149, decision 7 — kg only): how much the suggestion
 * goes up when it is time to add load ("↑ Suba para…") and the step of the
 * warm-up loads. An exercise's own increment, set in the program, wins
 * (decision D-G: UserProgramExercise.loadIncrementKg null = follow this).
 */
export const LOAD_INCREMENT_OPTIONS = [0.5, 1, 1.25, 2, 2.5, 5] as const;

export interface WorkoutPreferences {
  restTimerSound: boolean;
  hapticsEnabled: boolean;
  loadIncrementKg: number;
}
