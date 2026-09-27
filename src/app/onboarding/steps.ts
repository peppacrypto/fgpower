/** The wizard's steps, mirrored to `?passo=1..4` (plain module: the server page reads it too). */
export const TOTAL_STEPS = 4;

/** Why each step is asked — the kicker under the progress bar. */
export const STEP_REASONS = [
  "Para o seu perfil",
  "Para montar sua recomendação",
  "Para calibrar o treino",
  "Para escolher os exercícios",
] as const;
