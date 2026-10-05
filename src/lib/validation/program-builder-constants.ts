import { parseDecimalInput } from "@/lib/training/set-plan";
import type { ProgressionStrategy } from "@/lib/training/progression";

/**
 * Zod-free half of the program builder's validation, split out of
 * `program-builder.ts` so client screens that only need a constant or a
 * formatter (the workout execution screen) don't pull zod (~88 KB gzip) into
 * their route bundle (A-089). `program-builder.ts` holds the zod schemas and
 * re-exports everything here, so server importers are unaffected.
 */

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

/**
 * A row's prescription in one line: "3 × 8–12 · RIR 2 · 2:00 · +1 aquec.".
 * `restText` replaces the clock for a superset's member (W-104): "0:20 até
 * A2" (the switch), "2:00 após a rodada" (the last member's rest).
 */
export function prescriptionLine(p: Prescription, opts: { restText?: string } = {}): string {
  const reps = p.repMin === p.repMax ? `${p.repMin}` : `${p.repMin}–${p.repMax}`;
  const rir = p.rirTarget === null ? null : `RIR ${String(p.rirTarget).replace(".", ",")}`;
  const warmup = p.warmupSets > 0 ? `+${p.warmupSets} aquec.` : null;
  return [`${p.sets} × ${reps}`, rir, opts.restText ?? formatRestClock(p.restSeconds), warmup].filter(Boolean).join(" · ");
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

/**
 * The most non-archived programs (DRAFT + ACTIVE) one account may hold. Create,
 * duplicate, customize and adapt refuse past this — a single account could
 * otherwise fork programs without bound and fill the shared Postgres volume
 * (A-003). Archived programs are the user's history and don't count; the user
 * frees room by archiving or deleting one.
 */
export const MAX_PROGRAMS_PER_USER = 50;

/**
 * The name a create/rename stores: trimmed and capped to PROGRAM_NAME_MAX,
 * falling back to a default when blank so "   " never becomes an untitled
 * program (A-003). createCustomProgram's raw form value is client-controlled,
 * so the server normalizes it rather than trusting it.
 */
export function normalizeProgramName(raw: unknown, fallback = "Meu programa"): string {
  const trimmed = (typeof raw === "string" ? raw : "").trim().slice(0, PROGRAM_NAME_MAX);
  return trimmed || fallback;
}

export const PROGRESSION_STRATEGIES = [
  "DOUBLE",
  "LINEAR_LOAD",
  "REPETITION",
  "RIR_BASED",
  "MANUAL",
] as const satisfies readonly ProgressionStrategy[];

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
