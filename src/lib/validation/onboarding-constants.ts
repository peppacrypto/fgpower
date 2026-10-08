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

/**
 * Plausible bounds for the optional age and weight asked at onboarding (step 1).
 * Both are collected for the user's own profile and never gate anything — the
 * 18+ attestation (confirmedAdult) is the legal gate, not `age`. Weight shares
 * the BODYWEIGHT range in `lib/training/body-weight` (25–350 kg). Kept zod-free
 * here so the client wizard and the server schema use the same numbers.
 */
export const ONBOARDING_AGE = { min: 14, max: 99 } as const;
export const ONBOARDING_WEIGHT_KG = { min: 25, max: 350 } as const;
