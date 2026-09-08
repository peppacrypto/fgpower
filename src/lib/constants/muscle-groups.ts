export const MUSCLE_GROUPS = [
  "CHEST",
  "BACK",
  "SHOULDERS",
  "ARMS",
  "LEGS",
  "GLUTES",
  "CORE",
  "NECK",
  "FULL_BODY",
] as const;

export type MuscleGroupTag = (typeof MUSCLE_GROUPS)[number];

export const MUSCLE_GROUP_LABEL: Record<MuscleGroupTag, { en: string; pt: string }> = {
  CHEST: { en: "Chest", pt: "Peitoral" },
  BACK: { en: "Back", pt: "Costas" },
  SHOULDERS: { en: "Shoulders", pt: "Ombros" },
  ARMS: { en: "Arms", pt: "Braços" },
  LEGS: { en: "Legs", pt: "Pernas" },
  GLUTES: { en: "Glutes", pt: "Glúteos" },
  CORE: { en: "Core", pt: "Core" },
  NECK: { en: "Neck", pt: "Pescoço" },
  FULL_BODY: { en: "Full Body", pt: "Corpo inteiro" },
};
