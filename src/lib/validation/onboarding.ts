import { z } from "zod";

export const TRAINING_GOALS = [
  "HYPERTROPHY",
  "STRENGTH",
  "GENERAL_FITNESS",
  "STRENGTH_HYPERTROPHY",
  "SPORTS_PERFORMANCE",
] as const;

export const EXPERIENCE_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;

export const EQUIPMENT_ACCESS_OPTIONS = [
  "FULL_GYM",
  "HOME_DUMBBELLS",
  "HOME_BODYWEIGHT",
  "MINIMAL",
] as const;

export const onboardingSchema = z.object({
  displayName: z.string().trim().min(1, "Informe seu nome.").max(60),
  goal: z.enum(TRAINING_GOALS),
  experience: z.enum(EXPERIENCE_LEVELS),
  daysPerWeek: z.coerce.number().int().min(1).max(7),
  sessionMinutes: z.coerce.number().int().min(15).max(180),
  equipmentAccess: z.enum(EQUIPMENT_ACCESS_OPTIONS),
  preferredDays: z.array(z.coerce.number().int().min(0).max(6)).default([]),
  doesEndurance: z.coerce.boolean().default(false),
  enduranceNotes: z.string().trim().max(300).optional().or(z.literal("")),
  limitations: z.string().trim().max(500).optional().or(z.literal("")),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
