import { z } from "zod";
import { parseDecimalInput } from "@/lib/training/set-plan";
import type { ProgressionStrategy } from "@/lib/training/progression";

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
  warmupSets: "Aquecimento",
};

/** The rest chips (seconds): people think in "2 min", not "120". */
export const REST_PRESETS = [60, 90, 120, 150, 180, 240] as const;

/** 120 → "2:00", 90 → "1:30", 45 → "0:45". */
export function formatRestClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export interface Prescription {
  sets: number;
  repMin: number;
  repMax: number;
  rirTarget: number | null;
  restSeconds: number;
  warmupSets: number;
}

/**
 * What a newly added exercise starts with, by its mechanics: a compound lift
 * heavier and with longer rests (and one ramp-up set), an isolation lighter
 * and closer to failure with shorter rests. A calf raise and a deadlift no
 * longer both start at 3×8–12 / 120 s. Unknown mechanics keep that old middle.
 */
export function defaultPrescription(mechanics: string | null | undefined): Prescription {
  if (mechanics === "COMPOUND") return { sets: 3, repMin: 6, repMax: 10, rirTarget: 2, restSeconds: 150, warmupSets: 1 };
  if (mechanics === "ISOLATION") return { sets: 3, repMin: 10, repMax: 15, rirTarget: 1, restSeconds: 90, warmupSets: 0 };
  return { sets: 3, repMin: 8, repMax: 12, rirTarget: 2, restSeconds: 120, warmupSets: 0 };
}

/** A row's prescription in one line: "3 × 8–12 · RIR 2 · 2:00 · +1 aquec.". */
export function prescriptionLine(p: Prescription): string {
  const reps = p.repMin === p.repMax ? `${p.repMin}` : `${p.repMin}–${p.repMax}`;
  const rir = p.rirTarget === null ? null : `RIR ${String(p.rirTarget).replace(".", ",")}`;
  const warmup = p.warmupSets > 0 ? `+${p.warmupSets} aquec.` : null;
  return [`${p.sets} × ${reps}`, rir, formatRestClock(p.restSeconds), warmup].filter(Boolean).join(" · ");
}

/** Longest day focus ("Peito e tríceps, pesado") — matches the save schema. */
export const DAY_FOCUS_MAX = 200;
export const EXERCISE_NOTE_MAX = 2000;

/**
 * The program's own numbers (the builder header's stat chips). Weekly
 * frequency is at least one workout per day of the program (more repeats
 * days: a full body 3×, A/B 3×) and at most 7 — a program with more days
 * than a week keeps one workout per day. Duration is optional.
 */
export const PROGRAM_LIMITS = {
  daysPerWeek: { min: 1, max: 7 },
  durationWeeks: { min: 1, max: 52 },
} as const;

/** The weekly frequency range a program with `dayCount` days allows. */
export function frequencyRange(dayCount: number) {
  const days = Math.max(1, dayCount);
  return { min: days, max: Math.max(PROGRAM_LIMITS.daysPerWeek.max, days) };
}

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

export const PROGRESSION_STRATEGIES = [
  "DOUBLE",
  "LINEAR_LOAD",
  "REPETITION",
  "RIR_BASED",
  "MANUAL",
] as const satisfies readonly ProgressionStrategy[];

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
