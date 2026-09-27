export const GOAL_LABEL: Record<string, string> = {
  HYPERTROPHY: "Hipertrofia",
  STRENGTH: "Força",
  GENERAL_FITNESS: "Fitness geral",
  STRENGTH_HYPERTROPHY: "Força + Hipertrofia",
  SPORTS_PERFORMANCE: "Performance esportiva",
  FAT_LOSS: "Emagrecer / definir",
};

export const EXPERIENCE_LABEL: Record<string, string> = {
  BEGINNER: "Iniciante",
  INTERMEDIATE: "Intermediário",
  ADVANCED: "Avançado",
};

/** Split styles in Portuguese — the English names used to be shown as-is. */
export const STYLE_LABEL: Record<string, string> = {
  FULL_BODY: "Corpo inteiro",
  UPPER_LOWER: "Superior / Inferior",
  PUSH_PULL_LEGS: "Empurrar / Puxar / Pernas",
  BODY_PART_SPLIT: "Divisão por grupo",
  HYBRID: "Híbrido",
  ENDURANCE_SUPPORT: "Suporte à resistência",
};

/** The names people also search by (gym slang keeps the English terms). */
export const STYLE_ALIASES: Record<string, string> = {
  FULL_BODY: "full body fullbody",
  UPPER_LOWER: "upper lower",
  PUSH_PULL_LEGS: "push pull legs ppl",
  BODY_PART_SPLIT: "split",
  HYBRID: "",
  ENDURANCE_SUPPORT: "corrida endurance",
};

/** What a program needs / what the user has (same wording as onboarding). */
export const EQUIPMENT_LABEL: Record<string, string> = {
  FULL_GYM: "Academia completa",
  HOME_DUMBBELLS: "Halteres em casa",
  HOME_BODYWEIGHT: "Só peso do corpo",
  MINIMAL: "Equipamento mínimo",
};

export const PROGRESSION_LABEL: Record<string, string> = {
  DOUBLE: "Progressão dupla",
  LINEAR_LOAD: "Progressão linear de carga",
  REPETITION: "Progressão de repetições",
  RIR_BASED: "Progressão baseada em RIR",
  MANUAL: "Manual",
};

/** Accent hue per goal — used for the protocol-card spine and tag, so the library reads as a color-coded index. */
export const GOAL_HUE: Record<string, { bg: string; fg: string; spine: string }> = {
  HYPERTROPHY: { bg: "var(--tag-purple-bg)", fg: "var(--tag-purple-fg)", spine: "var(--tag-purple-fg)" },
  STRENGTH: { bg: "var(--tag-blue-bg)", fg: "var(--tag-blue-fg)", spine: "var(--tag-blue-fg)" },
  GENERAL_FITNESS: { bg: "var(--accent-soft)", fg: "var(--accent)", spine: "var(--accent)" },
  STRENGTH_HYPERTROPHY: { bg: "var(--tag-orange-bg)", fg: "var(--tag-orange-fg)", spine: "var(--tag-orange-fg)" },
  SPORTS_PERFORMANCE: { bg: "var(--tag-pink-bg)", fg: "var(--tag-pink-fg)", spine: "var(--tag-pink-fg)" },
  FAT_LOSS: { bg: "var(--accent-soft)", fg: "var(--accent)", spine: "var(--accent)" },
};

/** The one honest line for anyone whose goal is losing fat. */
export const FAT_LOSS_NOTE = "Musculação preserva músculo no déficit; quem emagrece é a dieta.";
