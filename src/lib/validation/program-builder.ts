import { z } from "zod";
import { parseDecimalInput } from "@/lib/training/set-plan";

/**
 * One set of bounds for the program builder, shared by the number boxes and
 * the server action (they used to disagree: the UI capped reps at 50 while
 * the server took 100). Server actions are client-controlled POSTs, so the
 * server still enforces every bound — without caps a user could persist
 * e.g. warmupSets: 2e9, which later blows up Array.from(...) and OOM-kills
 * the Node process.
 */
export const BUILDER_LIMITS = {
  sets: { min: 1, max: 30, step: 1 },
  repMin: { min: 1, max: 100, step: 1 },
  repMax: { min: 1, max: 100, step: 1 },
  rirTarget: { min: 0, max: 10, step: 0.5 },
  restSeconds: { min: 0, max: 3600, step: 1 },
  warmupSets: { min: 0, max: 15, step: 1 },
} as const;

export type BuilderNumberField = keyof typeof BUILDER_LIMITS;

export const BUILDER_FIELD_LABELS: Record<BuilderNumberField, string> = {
  sets: "Séries",
  repMin: "Rep. mín",
  repMax: "Rep. máx",
  rirTarget: "RIR",
  restSeconds: "Descanso (s)",
  warmupSets: "Aquec.",
};

export const PROGRAM_NAME_MAX = 120;
export const PROGRAM_DESCRIPTION_MAX = 2000;
export const DAY_NAME_MAX = 120;
export const MAX_PROGRAM_DAYS = 14;
export const MAX_DAY_EXERCISES = 40;

const bounded = (field: BuilderNumberField) => {
  const { min, max } = BUILDER_LIMITS[field];
  const n = z.coerce.number().min(min).max(max);
  return BUILDER_LIMITS[field].step === 1 ? n.int() : n;
};

export const builderExerciseSchema = z
  .object({
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
    notes: z.string().max(2000).nullable(),
  })
  .refine((ex) => ex.repMin <= ex.repMax, { path: ["repMin"], params: { rule: "rep-range" } });

export const builderProgramSchema = z.object({
  name: z.string().trim().min(1).max(PROGRAM_NAME_MAX),
  description: z.string().trim().max(PROGRAM_DESCRIPTION_MAX),
  days: z
    .array(
      z.object({
        id: z.string().max(64).optional(),
        name: z.string().max(DAY_NAME_MAX),
        focus: z.string().max(200).nullable(),
        exercises: z.array(builderExerciseSchema).max(MAX_DAY_EXERCISES),
      }),
    )
    .max(MAX_PROGRAM_DAYS),
});

export type BuilderProgramInput = z.input<typeof builderProgramSchema>;
export type BuilderProgramData = z.output<typeof builderProgramSchema>;

/**
 * A problem the user can fix, pinned to where it is. `dayIndex` /
 * `exerciseIndex` are positions in the payload that was validated; `field`
 * is a number field, "name", "description", "dayName", "days" or
 * "exercises". `message` is short, meant to sit under the field itself.
 */
export interface BuilderFieldError {
  dayIndex: number | null;
  exerciseIndex: number | null;
  field: string;
  message: string;
}

/** Shown after the field label ("Rep. mín: …"), so it does not repeat it. */
export const REP_RANGE_MESSAGE = "Maior que a Rep. máx.";

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
  if (path[0] !== "days") return { dayIndex: null, exerciseIndex: null, field: "form", message: "Valor inválido." };
  if (path.length === 1) {
    return { dayIndex: null, exerciseIndex: null, field: "days", message: `Máximo de ${MAX_PROGRAM_DAYS} dias.` };
  }
  const dayIndex = typeof path[1] === "number" ? path[1] : null;
  if (path[2] === "name") {
    return { dayIndex, exerciseIndex: null, field: "dayName", message: `Nome do dia longo demais (máx. ${DAY_NAME_MAX}).` };
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

/** True when `n` could be stored as is (in range, on the field's step). */
export function isStorableBuilderNumber(field: BuilderNumberField, n: number) {
  const { min, max, step } = BUILDER_LIMITS[field];
  return n >= min && n <= max && Math.abs(n / step - Math.round(n / step)) < 1e-9;
}

export type NumberCommit = {
  value: number | null;
  /** Why the stored value differs from what was typed; null when it does not. */
  adjusted: "min" | "max" | "step" | null;
};

/**
 * The blur rule for a number box. Empty or unreadable text brings back the
 * previous valid value (RIR may be left empty); anything else is rounded to
 * the field's step and clamped into range — never turned into 0.
 */
export function commitBuilderNumber(field: BuilderNumberField, raw: string, previous: number | null): NumberCommit {
  const n = parseDecimalInput(raw);
  if (n === null) {
    if (field === "rirTarget" && raw.trim() === "") return { value: null, adjusted: null };
    return { value: previous, adjusted: null };
  }
  const { min, max, step } = BUILDER_LIMITS[field];
  const stepped = Math.round(n / step) * step;
  if (stepped < min) return { value: min, adjusted: "min" };
  if (stepped > max) return { value: max, adjusted: "max" };
  return { value: stepped, adjusted: stepped !== n ? "step" : null };
}

/**
 * Keeps min ≤ max after the user leaves one of the two rep boxes: the value
 * just typed wins and the other bound follows it (8–12 → min 15 → 15–15, so
 * typing max 20 next gives the intended 15–20).
 */
export function reconcileRepRange(
  repMin: number,
  repMax: number,
  edited: "repMin" | "repMax",
): { repMin: number; repMax: number; adjusted: "repMin" | "repMax" | null } {
  if (repMin <= repMax) return { repMin, repMax, adjusted: null };
  return edited === "repMin"
    ? { repMin, repMax: repMin, adjusted: "repMax" }
    : { repMin: repMax, repMax, adjusted: "repMin" };
}
