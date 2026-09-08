/**
 * Shape of Exercise.contentEn / Exercise.contentPt (structured JSON).
 * Populated only for `isCurated` exercises — the rest ship with the basic
 * imported instructions and no rich content, which the exercise detail page
 * handles gracefully (see src/app/app/exercises/[slug]/page.tsx).
 */
export interface ExerciseContent {
  setup: string;
  breathing: string;
  coachingCues: string[];
  commonMistakes: string[];
  rangeOfMotion: string;
  whyThisExerciseExists: string;
}

/** Exercise.instructionsEn/instructionsPt are stored as Prisma `Json` (string[]). */
export function parseInstructions(json: unknown): string[] {
  if (!Array.isArray(json)) return [];
  return json.filter((x): x is string => typeof x === "string");
}

export function parseExerciseContent(json: unknown): ExerciseContent | null {
  if (!json || typeof json !== "object") return null;
  const obj = json as Record<string, unknown>;
  if (typeof obj.setup !== "string") return null;
  return {
    setup: obj.setup,
    breathing: typeof obj.breathing === "string" ? obj.breathing : "",
    coachingCues: Array.isArray(obj.coachingCues) ? obj.coachingCues.filter((x): x is string => typeof x === "string") : [],
    commonMistakes: Array.isArray(obj.commonMistakes) ? obj.commonMistakes.filter((x): x is string => typeof x === "string") : [],
    rangeOfMotion: typeof obj.rangeOfMotion === "string" ? obj.rangeOfMotion : "",
    whyThisExerciseExists: typeof obj.whyThisExerciseExists === "string" ? obj.whyThisExerciseExists : "",
  };
}
