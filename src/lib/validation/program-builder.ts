import { z } from "zod";
import {
  BUILDER_LIMITS,
  DAY_FOCUS_MAX,
  DAY_NAME_MAX,
  EXERCISE_NOTE_MAX,
  MAX_DAY_EXERCISES,
  MAX_PROGRAM_DAYS,
  PROGRAM_DESCRIPTION_MAX,
  PROGRAM_LIMITS,
  PROGRAM_NAME_MAX,
  PROGRESSION_STRATEGIES,
  REP_RANGE_MESSAGE,
  frequencyRange,
  type BuilderFieldError,
  type BuilderNumberField,
} from "./program-builder-constants";

// The zod-free constants, formatters and pure helpers live in
// `program-builder-constants` so client screens can import them without zod
// (A-089). Re-export them here so every existing importer of this module —
// server actions, pages and tests — is unaffected.
export * from "./program-builder-constants";

const bounded = (field: BuilderNumberField) => {
  const { min, max } = BUILDER_LIMITS[field];
  const n = z.coerce.number().min(min).max(max);
  return BUILDER_LIMITS[field].step === 1 ? n.int() : n;
};

/**
 * Prescription the builder shows no box for but carries along, so a
 * duplicated row keeps it. Only ever used to create a row — saving never
 * writes these onto an existing one — and a bad value is dropped rather than
 * blocking the save, since the user could not fix it on screen.
 */
const carried = <T extends z.ZodType>(schema: T) => schema.nullable().optional().catch(undefined);

export const builderExerciseSchema = z
  .object({
    /** The saved row's id (UserProgramExercise), so a save updates it in place. */
    id: z.string().min(1).max(64).optional(),
    exerciseId: z.string().min(1).max(64),
    exerciseName: z.string().max(200).optional(),
    groupKey: z.string().max(24).nullable(),
    sets: bounded("sets"),
    repMin: bounded("repMin"),
    repMax: bounded("repMax"),
    rirTarget: bounded("rirTarget").nullable(),
    restSeconds: bounded("restSeconds"),
    warmupSets: bounded("warmupSets"),
    loadTargetKg: z.coerce.number().min(0).max(2000).nullable(),
    notes: z.string().max(EXERCISE_NOTE_MAX).nullable(),
    rpeTarget: carried(z.number().min(0).max(10)),
    tempo: carried(z.string().max(32)),
    progressionStrategy: carried(z.enum(PROGRESSION_STRATEGIES)),
    loadIncrementKg: carried(z.number().min(0).max(100)),
  })
  .refine((ex) => ex.repMin <= ex.repMax, { path: ["repMin"], params: { rule: "rep-range" } });

export const builderProgramSchema = z
  .object({
    name: z.string().trim().min(1).max(PROGRAM_NAME_MAX),
    description: z.string().trim().max(PROGRAM_DESCRIPTION_MAX),
    days: z
      .array(
        z.object({
          id: z.string().max(64).optional(),
          name: z.string().max(DAY_NAME_MAX),
          focus: z.string().max(DAY_FOCUS_MAX).nullable(),
          exercises: z.array(builderExerciseSchema).max(MAX_DAY_EXERCISES),
        }),
      )
      .max(MAX_PROGRAM_DAYS),
    /** Absent (an older editor or draft): the server keeps inferring it from the days. */
    daysPerWeek: z.coerce.number().int().min(1).max(MAX_PROGRAM_DAYS).optional(),
    /** null = no set duration; absent = unchanged. */
    durationWeeks: z.coerce
      .number()
      .int()
      .min(PROGRAM_LIMITS.durationWeeks.min)
      .max(PROGRAM_LIMITS.durationWeeks.max)
      .nullable()
      .optional(),
  })
  .superRefine((p, ctx) => {
    if (p.daysPerWeek === undefined) return;
    const { min, max } = frequencyRange(p.days.length);
    if (p.daysPerWeek < min || p.daysPerWeek > max) {
      ctx.addIssue({ code: "custom", path: ["daysPerWeek"], params: { rule: "frequency", min, max } });
    }
  });

export type BuilderProgramInput = z.input<typeof builderProgramSchema>;
export type BuilderProgramData = z.output<typeof builderProgramSchema>;

function rangeMessage(field: BuilderNumberField) {
  const { min, max } = BUILDER_LIMITS[field];
  return `Use de ${min} a ${max}.`;
}

function issueToFieldError(issue: z.core.$ZodIssue): BuilderFieldError {
  const path = issue.path;
  if (path[0] === "name") {
    return {
      dayIndex: null,
      exerciseIndex: null,
      field: "name",
      message: issue.code === "too_big" ? `Nome longo demais (máx. ${PROGRAM_NAME_MAX}).` : "Dê um nome ao programa.",
    };
  }
  if (path[0] === "description") {
    return {
      dayIndex: null,
      exerciseIndex: null,
      field: "description",
      message: `Descrição longa demais (máx. ${PROGRAM_DESCRIPTION_MAX} caracteres).`,
    };
  }
  if (path[0] === "daysPerWeek") {
    const params = (issue as { params?: { min?: number; max?: number } }).params;
    const min = params?.min ?? PROGRAM_LIMITS.daysPerWeek.min;
    const max = params?.max ?? PROGRAM_LIMITS.daysPerWeek.max;
    return {
      dayIndex: null,
      exerciseIndex: null,
      field: "daysPerWeek",
      message: min === max ? `Use ${min} — um por dia.` : `Use de ${min} a ${max} — ao menos um por dia.`,
    };
  }
  if (path[0] === "durationWeeks") {
    const { min, max } = PROGRAM_LIMITS.durationWeeks;
    return { dayIndex: null, exerciseIndex: null, field: "durationWeeks", message: `Use de ${min} a ${max} semanas, ou deixe vazio.` };
  }
  if (path[0] !== "days") return { dayIndex: null, exerciseIndex: null, field: "form", message: "Valor inválido." };
  if (path.length === 1) {
    return { dayIndex: null, exerciseIndex: null, field: "days", message: `Máximo de ${MAX_PROGRAM_DAYS} dias.` };
  }
  const dayIndex = typeof path[1] === "number" ? path[1] : null;
  if (path[2] === "name") {
    return { dayIndex, exerciseIndex: null, field: "dayName", message: `Nome do dia longo demais (máx. ${DAY_NAME_MAX}).` };
  }
  if (path[2] === "focus") {
    return { dayIndex, exerciseIndex: null, field: "dayFocus", message: `Foco do dia longo demais (máx. ${DAY_FOCUS_MAX}).` };
  }
  if (path[2] === "exercises" && path.length === 3) {
    return { dayIndex, exerciseIndex: null, field: "exercises", message: `Máximo de ${MAX_DAY_EXERCISES} exercícios por dia.` };
  }
  const exerciseIndex = typeof path[3] === "number" ? path[3] : null;
  const field = String(path[4] ?? "exercise");
  if (issue.code === "custom" && field === "repMin") {
    return { dayIndex, exerciseIndex, field, message: REP_RANGE_MESSAGE };
  }
  if (field in BUILDER_LIMITS) {
    return { dayIndex, exerciseIndex, field, message: rangeMessage(field as BuilderNumberField) };
  }
  if (field === "notes") {
    return { dayIndex, exerciseIndex, field, message: `Nota longa demais (máx. ${EXERCISE_NOTE_MAX} caracteres).` };
  }
  return { dayIndex, exerciseIndex, field, message: "Valor inválido." };
}

export type BuilderValidation =
  | { ok: true; data: BuilderProgramData }
  | { ok: false; errors: BuilderFieldError[] };

/** Validates a whole builder payload; never throws. Used on both sides. */
export function validateBuilderProgram(input: unknown): BuilderValidation {
  const parsed = builderProgramSchema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, errors: parsed.error.issues.map(issueToFieldError) };
}
