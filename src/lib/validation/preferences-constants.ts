/**
 * Zod-free half of Settings → Durante o treino, split out of `preferences.ts`
 * so the Settings client form imports the shape without pulling zod (~88 KB
 * gzip) into the route bundle (A-089). `preferences.ts` holds the schema and a
 * compile-time check that it still matches this type.
 *
 * The single "Salto de carga" that lived here (W-149, LOAD_INCREMENT_OPTIONS)
 * is retired: loads move along the gym's equipment instead (Settings → Minha
 * academia, lib/training/load-grid). Profile.loadIncrementKg stays in the
 * table, unread, so an older image still runs.
 */

export interface WorkoutPreferences {
  restTimerSound: boolean;
  hapticsEnabled: boolean;
}
