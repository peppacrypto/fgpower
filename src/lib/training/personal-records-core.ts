import { estimate1Rm } from "./estimated-1rm";
import { formatKg, formatVolume, plural } from "@/lib/utils/format";

/**
 * Personal-record rules, kept pure so they can be tested without a database
 * (the DB side lives in personal-records.ts).
 *
 * - An exercise's FIRST completed log is its baseline ("marca inicial"): it
 *   records nothing. Before, every first workout produced 3–4 "records" per
 *   exercise and buried the real ones.
 * - Records are measured against the user's other COMPLETED sessions only —
 *   never against the other sets of the same session (tied straight sets used
 *   to cancel each other's rep record) or a discarded/in-progress workout.
 * - A rep record is per load: 13 reps with 60 kg beats the best ever done with
 *   60 kg, and is not blocked by 15 reps done with 40 kg.
 */

export type PrKind = "MAX_WEIGHT" | "ESTIMATED_1RM" | "MAX_REPS_AT_WEIGHT" | "SESSION_VOLUME";

/**
 * The kinds recorded and shown (summary, Today, feed, progress), in display
 * order. SESSION_VOLUME is no longer recorded — the best session volume is
 * derived from the logs where it is shown (exercise history); old rows stay
 * in the table and every list filters them out.
 */
export const SHOWN_PR_KINDS = ["MAX_WEIGHT", "ESTIMATED_1RM", "MAX_REPS_AT_WEIGHT"] as const;
export type ShownPrKind = (typeof SHOWN_PR_KINDS)[number];

export function isShownPrKind(kind: string): kind is ShownPrKind {
  return (SHOWN_PR_KINDS as readonly string[]).includes(kind);
}

/** A completed working set of the session being scored, in the order it was done. */
export interface ScoredSet {
  id: string;
  weightKg: number;
  reps: number;
}

/** A completed working set of the same exercise in another COMPLETED session. */
export interface PriorSet {
  weightKg: number;
  reps: number;
}

export interface RecordCandidate {
  kind: ShownPrKind;
  value: number;
  weightKg: number;
  reps: number;
  setLogId: string;
}

export type ExerciseRecordResult =
  /** First time this exercise was logged: the session sets the marks, nothing is a record. */
  | { baseline: true; records: [] }
  | { baseline: false; records: RecordCandidate[] };

const EPS = 1e-6;
const sameLoad = (a: number, b: number) => Math.abs(a - b) < EPS;
const usable = (s: { weightKg: number; reps: number }) =>
  Number.isFinite(s.weightKg) && s.weightKg >= 0 && Number.isInteger(s.reps) && s.reps >= 1;

/** Best reliable e1RM (≤ 10 reps, load > 0) among `sets`, with the set that gives it. */
function best1Rm<T extends PriorSet>(sets: T[]): { value: number; set: T } | null {
  let best: { value: number; set: T } | null = null;
  for (const s of sets) {
    const est = estimate1Rm(s.weightKg, s.reps);
    if (est.reliable && est.epleyKg != null && (!best || est.epleyKg > best.value)) best = { value: est.epleyKg, set: s };
  }
  return best;
}

/**
 * The records one exercise set in a session, measured against `prior` (its
 * completed working sets in the user's other COMPLETED sessions).
 */
export function detectExerciseRecords(sets: ScoredSet[], prior: PriorSet[]): ExerciseRecordResult {
  const done = sets.filter(usable);
  const history = prior.filter(usable);
  if (done.length === 0) return { baseline: false, records: [] };
  if (history.length === 0) return { baseline: true, records: [] };

  const records: RecordCandidate[] = [];

  // --- MAX_WEIGHT: heavier than anything done before (with the most reps at that load).
  const priorTop = Math.max(...history.map((p) => p.weightKg));
  const top = done.reduce((a, b) =>
    b.weightKg > a.weightKg + EPS || (sameLoad(b.weightKg, a.weightKg) && b.reps > a.reps) ? b : a,
  );
  if (top.weightKg > 0 && top.weightKg > priorTop + EPS) {
    records.push({ kind: "MAX_WEIGHT", value: top.weightKg, weightKg: top.weightKg, reps: top.reps, setLogId: top.id });
  }

  // --- ESTIMATED_1RM: only against an earlier reliable estimate (sets above
  // 10 reps give none), so a first low-rep set isn't a "record" over nothing.
  const now1Rm = best1Rm(done);
  const before1Rm = best1Rm(history);
  // A set that is no better than one already done (as heavy, as many reps) is
  // never a record, even when the earlier one was too long to estimate from.
  const dominated =
    now1Rm !== null &&
    history.some((p) => p.weightKg >= now1Rm.set.weightKg - EPS && p.reps >= now1Rm.set.reps);
  if (now1Rm && before1Rm && !dominated && now1Rm.value > before1Rm.value + EPS) {
    records.push({
      kind: "ESTIMATED_1RM",
      value: now1Rm.value,
      weightKg: now1Rm.set.weightKg,
      reps: now1Rm.set.reps,
      setLogId: now1Rm.set.id,
    });
  }

  // --- MAX_REPS_AT_WEIGHT: per load already used before (a new load is either
  // a weight record or a lighter one-off, not a rep record). Bodyweight (0 kg)
  // counts. The first set that reached the session's best reps carries it.
  const bestByLoad: ScoredSet[] = [];
  for (const s of done) {
    const i = bestByLoad.findIndex((b) => sameLoad(b.weightKg, s.weightKg));
    if (i === -1) bestByLoad.push(s);
    else if (s.reps > bestByLoad[i].reps) bestByLoad[i] = s;
  }
  for (const best of bestByLoad) {
    const atLoad = history.filter((p) => sameLoad(p.weightKg, best.weightKg));
    if (atLoad.length === 0) continue;
    if (best.reps <= Math.max(...atLoad.map((p) => p.reps))) continue;
    // As many reps already done with MORE weight: not a record.
    if (history.some((p) => p.weightKg > best.weightKg + EPS && p.reps >= best.reps)) continue;
    records.push({
      kind: "MAX_REPS_AT_WEIGHT",
      value: best.reps,
      weightKg: best.weightKg,
      reps: best.reps,
      setLogId: best.id,
    });
  }

  return { baseline: false, records };
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

export interface RecordLike {
  kind: PrKind | string;
  value: number | null;
  weightKg: number | null;
  reps: number | null;
}

/** What a record kind is called when its numbers are hidden (feed with loads off). */
export const PR_KIND_LABEL: Record<PrKind, string> = {
  MAX_WEIGHT: "recorde de carga",
  ESTIMATED_1RM: "1RM estimado",
  MAX_REPS_AT_WEIGHT: "recorde de repetições",
  SESSION_VOLUME: "volume",
};

/**
 * One record as short pt-BR text: "carga 65 kg", "1RM est. 79,2 kg",
 * "13 reps com 60 kg", "15 reps (peso corporal)". Without the loads
 * (`hideLoads`, or a feed summary that stripped them) it falls back to the
 * kind's name — a rep count alone is never a load, so it stays ("recorde de 13 reps").
 */
export function describeRecord(r: RecordLike, hideLoads = false): string {
  const kind = r.kind as PrKind;
  switch (kind) {
    case "MAX_WEIGHT":
      return !hideLoads && r.value != null ? `carga ${formatKg(r.value)}` : PR_KIND_LABEL.MAX_WEIGHT;
    case "ESTIMATED_1RM":
      return !hideLoads && r.value != null ? `1RM est. ${formatKg(r.value)}` : PR_KIND_LABEL.ESTIMATED_1RM;
    case "MAX_REPS_AT_WEIGHT": {
      const reps = r.reps ?? r.value;
      if (reps == null) return PR_KIND_LABEL.MAX_REPS_AT_WEIGHT;
      if (r.weightKg === 0) return `${plural(reps, "rep", "reps")} (peso corporal)`;
      if (hideLoads || r.weightKg == null) return `recorde de ${plural(reps, "rep", "reps")}`;
      return `${plural(reps, "rep", "reps")} com ${formatKg(r.weightKg)}`;
    }
    case "SESSION_VOLUME":
      return !hideLoads && r.value != null ? `volume ${formatVolume(r.value)}` : PR_KIND_LABEL.SESSION_VOLUME;
    default:
      return "recorde";
  }
}

/**
 * Records grouped one entry per exercise: exercises in `order` (the workout's
 * order; unknown ones last, in first-seen order), kinds in display order,
 * SESSION_VOLUME dropped.
 */
export function groupRecordsByExercise<T extends { kind: string }>(
  records: T[],
  keyOf: (r: T) => string,
  order: string[] = [],
): { key: string; records: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const r of records) {
    if (!isShownPrKind(r.kind)) continue;
    const key = keyOf(r);
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }
  const rank = (key: string) => {
    const i = order.indexOf(key);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  const kindRank = (k: string) => SHOWN_PR_KINDS.indexOf(k as ShownPrKind);
  return [...groups.entries()]
    .map(([key, list], seen) => ({ key, seen, records: [...list].sort((a, b) => kindRank(a.kind) - kindRank(b.kind)) }))
    .sort((a, b) => rank(a.key) - rank(b.key) || a.seen - b.seen)
    .map(({ key, records: list }) => ({ key, records: list }));
}
