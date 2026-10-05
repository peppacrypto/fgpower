import { z } from "zod";
import { EQUIPMENT_ACCESS_OPTIONS, EXPERIENCE_LEVELS, TRAINING_GOALS } from "./onboarding-constants";

// The option enums live zod-free in `onboarding-constants` so the Settings
// profile form can import them without zod (A-089). Re-export so every server
// importer of this module is unaffected.
export * from "./onboarding-constants";

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
  // A-049: attested 18+ (owner/legal set the real minimum + minor flow).
  confirmedAdult: z.boolean().refine((v) => v === true, { message: "Confirme que você tem 18 anos ou mais para continuar." }),
  // A-008: specific, separate health-data consent (LGPD art. 11).
  healthConsent: z.boolean().refine((v) => v === true, { message: "É necessário concordar para continuar." }),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
