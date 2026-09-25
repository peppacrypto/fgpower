/**
 * Pure helpers for the workout set table: how a logged exercise's set rows
 * split into warm-ups / prescribed / extra, when an exercise counts as done,
 * which values to suggest in an empty row, and pt-BR decimal input parsing.
 * Shared by the execution client and the server actions; no I/O here.
 */

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

/**
 * The grey hint shown in an empty row (and used when the user taps ✓ without
 * typing). Load carries over from the row above in *this* session — what the
 * user just lifted — falling back to last time's matching set; reps come from
 * last time's matching set (the number to beat), then the row above.
 * Warm-ups get no suggestion: last time's working loads would be wrong there.
 */
export function suggestFor(
  kind: SetKind,
  ordinal: number,
  above: SuggestedValues | null,
  previous: PreviousSet[],
): SuggestedValues {
  if (kind === "WARMUP") return { weightKg: null, reps: null };
  const prevPrescribed = previous.filter((p) => !p.isExtra);
  const pool = kind === "EXTRA" ? previous : prevPrescribed;
  const last = pool.length > 0 ? pool[pool.length - 1] : null;
  const match = kind === "PRESCRIBED" ? (prevPrescribed[ordinal - 1] ?? last) : last;
  return {
    weightKg: above?.weightKg ?? match?.weightKg ?? null,
    reps: match?.reps ?? above?.reps ?? null,
  };
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
