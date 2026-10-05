/**
 * Zod-free enums from the onboarding schema, split out of `onboarding.ts` so
 * the Settings profile form imports the option lists without pulling zod
 * (~88 KB gzip) into the route bundle (A-089). `onboarding.ts` builds its
 * schema from these and re-exports them, so server importers are unaffected.
 */

export const TRAINING_GOALS = [
  "HYPERTROPHY",
  "STRENGTH",
  "GENERAL_FITNESS",
  "STRENGTH_HYPERTROPHY",
  "SPORTS_PERFORMANCE",
  "FAT_LOSS",
] as const;

export const EXPERIENCE_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;

export const EQUIPMENT_ACCESS_OPTIONS = [
  "FULL_GYM",
  "HOME_DUMBBELLS",
  "HOME_BODYWEIGHT",
  "MINIMAL",
] as const;
