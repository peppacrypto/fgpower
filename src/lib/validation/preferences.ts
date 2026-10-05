import { z } from "zod";
import type { WorkoutPreferences } from "./preferences-constants";

// LOAD_INCREMENT_OPTIONS and the WorkoutPreferences type live zod-free in
// `preferences-constants` so the Settings client form can import them without
// zod (A-089). Re-export so server importers of this module are unaffected.
export * from "./preferences-constants";

/**
 * Settings → Durante o treino (lib/actions/preferences.ts). A plain module:
 * a 'use server' file may only export async functions.
 */

/** A quarter-kilo grid: every plate step there is, and values stored before these options existed (0,75). */
const onQuarterKg = (v: number) => Math.abs(v * 4 - Math.round(v * 4)) < 1e-9;

export const workoutPreferencesSchema = z
  .object({
    restTimerSound: z.boolean(),
    hapticsEnabled: z.boolean(),
    loadIncrementKg: z.number().min(0.25).max(20).refine(onQuarterKg),
  })
  .strict();

/**
 * Compile-time guard: the hand-written WorkoutPreferences (preferences-constants,
 * kept zod-free for the client) must stay identical to what the schema parses
 * to. This assertion fails to compile if the two ever drift; it is a type-only
 * invariant (erased at build) and is exported so it is a referenced binding
 * rather than dead code.
 */
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
export type WorkoutPreferencesInSync = Assert<Equal<z.infer<typeof workoutPreferencesSchema>, WorkoutPreferences>>;
