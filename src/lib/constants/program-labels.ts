export const GOAL_LABEL: Record<string, string> = {
  HYPERTROPHY: "Hipertrofia",
  STRENGTH: "Força",
  GENERAL_FITNESS: "Fitness geral",
  STRENGTH_HYPERTROPHY: "Força + Hipertrofia",
  SPORTS_PERFORMANCE: "Performance esportiva",
};

export const EXPERIENCE_LABEL: Record<string, string> = {
  BEGINNER: "Iniciante",
  INTERMEDIATE: "Intermediário",
  ADVANCED: "Avançado",
};

export const STYLE_LABEL: Record<string, string> = {
  FULL_BODY: "Full Body",
  UPPER_LOWER: "Upper / Lower",
  PUSH_PULL_LEGS: "Push Pull Legs",
  BODY_PART_SPLIT: "Divisão por grupo",
  HYBRID: "Híbrido",
  ENDURANCE_SUPPORT: "Suporte à resistência",
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
};
