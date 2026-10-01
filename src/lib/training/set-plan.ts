/**
 * Pure helpers for the workout set table: how a logged exercise's set rows
 * split into warm-ups / prescribed / extra, when an exercise counts as done,
 * which values to suggest in an empty row (warm-ups included), bodyweight
 * and timed exercises (and how their sets print), and pt-BR decimal input
 * parsing.
 * Shared by the execution client and the server actions; no I/O here.
 */

import { formatKg } from "@/lib/utils/format";
import { adviseNextLoad, type NextLoadAdvice } from "./next-load";
import type { ProgressionStrategy } from "./progression";

export type SetKind = "WARMUP" | "PRESCRIBED" | "EXTRA";

export interface PlanSet {
  id: string;
  setNumber: number;
  setType: "WARMUP" | "WORKING" | "DROP" | "FAILURE";
  isExtra: boolean;
  isCompleted: boolean;
  weightKg: number | null;
  reps: number | null;
}

export interface PlannedRow<S extends PlanSet = PlanSet> {
  set: S;
  kind: SetKind;
  /** 1-based position within its kind (warm-up 1, série 1, extra 1…). */
  ordinal: number;
}

export function setKind(set: Pick<PlanSet, "setType" | "isExtra">): SetKind {
  if (set.setType === "WARMUP") return "WARMUP";
  return set.isExtra ? "EXTRA" : "PRESCRIBED";
}

/** Splits an exercise's sets into ordered warm-up / prescribed / extra rows. */
export function planRows<S extends PlanSet>(sets: S[]): {
  warmups: PlannedRow<S>[];
  prescribed: PlannedRow<S>[];
  extras: PlannedRow<S>[];
} {
  const sorted = [...sets].sort((a, b) => a.setNumber - b.setNumber);
  const out = { warmups: [] as PlannedRow<S>[], prescribed: [] as PlannedRow<S>[], extras: [] as PlannedRow<S>[] };
  for (const set of sorted) {
    const kind = setKind(set);
    const bucket = kind === "WARMUP" ? out.warmups : kind === "EXTRA" ? out.extras : out.prescribed;
    bucket.push({ set, kind, ordinal: bucket.length + 1 });
  }
  return out;
}

/**
 * An exercise is done when every prescribed set is completed (or it was
 * skipped). Warm-ups and extras never block it: an empty extra row must not
 * hide "Próximo exercício" / "Finalizar treino".
 */
export function isExerciseDone(sets: PlanSet[], wasSkipped = false): boolean {
  if (wasSkipped) return true;
  const { prescribed, extras } = planRows(sets);
  if (prescribed.length > 0) return prescribed.every((r) => r.set.isCompleted);
  return extras.length > 0 && extras.some((r) => r.set.isCompleted);
}

export interface SuggestedValues {
  weightKg: number | null;
  reps: number | null;
}

export interface PreviousSet {
  weightKg: number | null;
  reps: number | null;
  isExtra?: boolean;
}

/** What an exercise's empty rows can be suggested from. */
export interface SuggestContext {
  /** Last time's completed working sets, in order (extras flagged). */
  previous: PreviousSet[];
  /**
   * The progression verdict for today (lib/training/next-load): the load to
   * lift and, when the advice is about reps, the reps to aim for; `hold`
   * keeps the load (each set then aims for at least what it did last time).
   */
  target?: { kind: "increase" | "hold"; loadKg: number; targetReps: number | null } | null;
  /** Reps to aim for when nothing else says (no history): see firstTimeReps. */
  prescribedReps?: number | null;
  /**
   * A bodyweight exercise (isBodyweightEquipment): the load is extra load,
   * 0 kg unless the user adds some — so ✓ never waits for a kg.
   */
  bodyweight?: boolean;
}

/**
 * The grey hint shown in an empty row (and used when the user taps ✓ without
 * typing). Load carries over from the row above in *this* session — what the
 * user just lifted — then the progression's load for today, then last time's
 * matching set; reps come from the progression's target, then last time's
 * matching set (the number to beat), then the row above, then the
 * prescription — so on a first workout ✓ only needs the load. A bodyweight
 * exercise's load falls back to 0 kg (no extra load): ✓ needs nothing.
 * Holding a load, the target is a floor, not a cap: a set that did more reps
 * at that load last time aims for at least as many again (12,10,9 → 12,10,10),
 * never fewer than it managed.
 * Warm-ups are suggested separately (warmupSuggestions).
 */
export function suggestFor(
  kind: SetKind,
  ordinal: number,
  above: SuggestedValues | null,
  ctx: SuggestContext,
): SuggestedValues {
  if (kind === "WARMUP") return { weightKg: null, reps: null };
  const { previous } = ctx;
  const target = kind === "PRESCRIBED" ? (ctx.target ?? null) : null;
  const prevPrescribed = previous.filter((p) => !p.isExtra);
  const pool = kind === "EXTRA" ? previous : prevPrescribed;
  const last = pool.length > 0 ? pool[pool.length - 1] : null;
  const match = kind === "PRESCRIBED" ? (prevPrescribed[ordinal - 1] ?? last) : last;
  const weightKg = above?.weightKg ?? target?.loadKg ?? match?.weightKg ?? (ctx.bodyweight ? 0 : null);
  let reps = target?.targetReps ?? match?.reps ?? above?.reps ?? ctx.prescribedReps ?? null;
  const sameLoadAsLastTime =
    weightKg !== null && match?.weightKg != null && Math.abs(match.weightKg - weightKg) < 0.001;
  if (target?.kind === "hold" && sameLoadAsLastTime && match?.reps != null) reps = Math.max(reps ?? 0, match.reps);
  return { weightKg, reps };
}

/**
 * The reps a first-timer aims for: the top of a hypertrophy range (a light,
 * safe first load — "8–12" → 12), the bottom of a heavy one ("3–5" → 3,
 * whenever the range tops out at 6 or less). With the body's own weight
 * there is no load to pick light: the bottom of the range ("8–15" push-ups →
 * 8, a "20–45 s" plank → 20), so a ✓ on the empty box never logs 15 push-ups
 * a beginner didn't do — the record, the baseline and the next progression
 * start from what is reachable (L-bodyweight-first-target).
 */
export function firstTimeReps(repMin: number, repMax: number, opts: { bodyweight?: boolean } = {}): number | null {
  const top = Math.max(repMin, repMax);
  const bottom = Math.min(repMin, repMax);
  if (!(top > 0)) return null;
  if (opts.bodyweight) return Math.max(1, bottom);
  return top <= 6 ? Math.max(1, bottom) : top;
}

/**
 * An exercise done with the body's own weight (push-ups, pull-ups, plank…):
 * equipment category BODYWEIGHT, or NONE (no equipment at all). Its kg is
 * extra load — 0 unless the user adds a vest or a dumbbell.
 */
export function isBodyweightEquipment(category: string | null | undefined): boolean {
  return category === "BODYWEIGHT" || category === "NONE";
}

/**
 * Holds whose "reps" are always seconds, whatever the program's note says.
 * Every surface that knows only the exercise (summary, exercise history)
 * relies on this list, so a hold the programs time belongs here, not only in
 * its notes (plate-pinch: "As repetições = segundos de sustentação por mão").
 */
const TIMED_HOLD_SLUGS = new Set(["plank", "side-bridge", "plate-pinch"]);

/**
 * Program notes that say the numbers are seconds: "Os números são (o tempo
 * em) segundos", "As repetições são / = / significam segundos", "as 'reps'
 * representam segundos", "SEGUNDOS de sustentação, não repetições". Loose
 * mentions of seconds ("3 s na descida", "metros (ou segundos)", "cada rep =
 * uma sustentação de ~10 s") don't count.
 */
const SECONDS_NOTE = [
  /\b(?:n[úu]meros|reps?|repeti[çc](?:ão|ões))['’”"]?\s+(?:s[ãa]o|=|significam|representam)\s+(?:o\s+tempo\s+em\s+)?segundos\b/i,
  /\bsegundos\b[^.]{0,40}\bn[ãa]o\s+repeti[çc]/i,
];

/**
 * An isometric hold whose prescribed "reps" are seconds (Prancha: "Os números
 * são o tempo em segundos"): the exercise is one of the known holds, or its
 * program note says so in so many words. Anything less clear stays reps.
 */
export function isTimedHold(exercise: { slug?: string | null; notes?: string | null }): boolean {
  if (exercise.slug && TIMED_HOLD_SLUGS.has(exercise.slug)) return true;
  const notes = exercise.notes ?? "";
  return notes !== "" && SECONDS_NOTE.some((re) => re.test(notes));
}

const NBSP = " ";

/**
 * A logged set as the app prints it: "60 kg × 10". A set without load (a
 * bodyweight set: 0 kg) drops it — "× 12" — and a timed hold's reps are
 * seconds: "45 s", "10 kg × 45 s".
 */
export function formatSet(
  weightKg: number | null | undefined,
  reps: number | null | undefined,
  opts: { timed?: boolean } = {},
): string {
  const amount = reps == null ? "—" : opts.timed ? `${reps}${NBSP}s` : String(reps);
  if (weightKg === 0) return opts.timed ? amount : `×${NBSP}${amount}`;
  return `${formatKg(weightKg)} × ${amount}`;
}

/** Share of the first working load × reps for each warm-up, by how many the program asks for. */
const WARMUP_RAMPS: Record<number, [number, number][]> = {
  1: [[0.6, 5]],
  2: [
    [0.5, 8],
    [0.7, 4],
  ],
  3: [
    [0.4, 8],
    [0.6, 5],
    [0.8, 3],
  ],
};

/**
 * Warm-up loads ramping up to the first working set (~50% × 8, ~70% × 4 for
 * two warm-ups), rounded to the load step. Nothing without a known working
 * load, and no row that would round to nothing or to the working load itself.
 */
export function warmupSuggestions(count: number, workingLoadKg: number | null, stepKg: number): SuggestedValues[] {
  const n = Math.max(0, Math.floor(count));
  const step = stepKg > 0 ? stepKg : 2.5;
  const ramp =
    WARMUP_RAMPS[n] ??
    Array.from({ length: n }, (_, i): [number, number] => [0.4 + (0.4 * i) / Math.max(1, n - 1), Math.round(8 - (5 * i) / Math.max(1, n - 1))]);
  return ramp.map(([share, reps]) => {
    if (workingLoadKg === null || !(workingLoadKg > 0)) return { weightKg: null, reps: null };
    const kg = Math.round(Math.round((workingLoadKg * share) / step) * step * 100) / 100;
    return kg > 0 && kg < workingLoadKg ? { weightKg: kg, reps } : { weightKg: null, reps: null };
  });
}

/** Last time's performance of an exercise, as the progression advice reads it. */
export interface LastTimeSets {
  /** Completed working sets, in order; extras are flagged and don't count toward the prescription. */
  sets: { weightKg: number | null; reps: number | null; rir: number | null; isExtra: boolean }[];
  /** How many working sets that session prescribed. */
  prescribedSets: number;
}

/**
 * What to lift today, judged from last time's prescribed sets against today's
 * prescription (lib/training/next-load). A load increase needs the whole
 * prescription done: after 1 of 3 sets at the top of the range it holds the
 * load and asks for all the sets first.
 */
export function adviceFromLastTime(input: {
  strategy: ProgressionStrategy | null;
  prescribed: { repMin: number; repMax: number; rirTarget: number | null };
  lastTime: LastTimeSets | null;
  loadIncrementKg: number;
  /** A hold (isTimedHold): the advice speaks in seconds (adviceInSeconds). */
  timed?: boolean;
}): NextLoadAdvice | null {
  const sets = (input.lastTime?.sets ?? [])
    .filter((s) => !s.isExtra)
    .map(({ weightKg, reps, rir }) => ({ weightKg, reps, rir }));
  if (sets.length === 0) return null;
  const advice = adviseNextLoad({
    strategy: input.strategy,
    prescribed: input.prescribed,
    sets,
    loadIncrementKg: input.loadIncrementKg,
  });
  const asked = input.lastTime?.prescribedSets ?? 0;
  if (advice?.kind === "increase" && sets.length < asked) {
    const top = Math.max(...sets.map((s) => s.weightKg ?? 0));
    return {
      kind: "hold",
      loadKg: top,
      targetReps: null,
      headline: `Mantenha ${formatKg(top)} · faça as ${asked} séries`,
      reason: `Na última vez: ${sets.length} de ${asked} séries. Suba a carga quando fizer todas`,
    };
  }
  return input.timed && advice ? adviceInSeconds(advice) : advice;
}

/**
 * A loaded hold's advice (plate-pinch with 10 kg) in seconds: next-load
 * words its targets as reps ("Mantenha 10 kg · busque 25 reps"), which on a
 * hold are the seconds held — "Mantenha 10 kg · segure 25 s", "Suba a carga
 * quando segurar 30 s em todas". A bodyweight hold gets no advice at all
 * (next-load has no load to move).
 */
export function adviceInSeconds<A extends Pick<NextLoadAdvice, "headline" | "reason">>(advice: A): A {
  const toSeconds = (text: string) =>
    text
      .replace(/\b(\d+\+?) reps\b/g, `$1${NBSP}s`)
      .replace(/\b(?:busque|complete) (\d+\+?\u00a0s)/g, "segure $1")
      .replace(/\bfizer (\d)/g, "segurar $1")
      .replace(/\bFez (\d)/g, "Segurou $1")
      .replace(/\bmais reps\b/g, "mais segundos");
  return { ...advice, headline: toSeconds(advice.headline), reason: toSeconds(advice.reason) };
}

/** The science page behind a progression strategy's advice ("por quê?"). */
export function progressionPrincipleSlug(strategy: ProgressionStrategy | null): string | null {
  switch (strategy ?? "DOUBLE") {
    case "DOUBLE":
    case "REPETITION":
      return "double-progression";
    case "LINEAR_LOAD":
      return "progressive-overload";
    case "RIR_BASED":
      return "rir";
    default:
      return null;
  }
}

/** Parses a load/reps box: accepts "42,5" and "42.5"; empty/invalid → null. */
export function parseDecimalInput(raw: string): number | null {
  const s = raw.trim().replace(/\s+/g, "").replace(",", ".");
  if (s === "" || !/^\d*\.?\d*$/.test(s) || s === ".") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Formats a stored number for a pt-BR input: 42.5 → "42,5", 40 → "40". */
export function formatDecimal(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "";
  return String(Math.round(n * 100) / 100).replace(".", ",");
}
