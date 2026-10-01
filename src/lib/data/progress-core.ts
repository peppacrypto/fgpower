import { formatKg, formatNumber, plural } from "@/lib/utils/format";
import { dayNumberOf, mondayOf } from "@/lib/training/day-rotation";
import { formatSet } from "@/lib/training/set-plan";
import { zonedMidnight } from "@/lib/training/week";
import { VOLUME_MUSCLES } from "@/lib/programming/exercise-facets";
import { volumeStatus, type VolumeRow } from "@/lib/programming/weekly-volume";

export type ProgressPeriod = "4w" | "8w" | "3m" | "6m" | "1y" | "all";

/*
 * Pure rules behind the progress screens (the queries live in progress.ts
 * and history.ts): how one session of an exercise is summed up, which number
 * shows an exercise's progress, and how two sessions compare — kept free of
 * the database so they are tested directly.
 */

/**
 * One finished session of one exercise, aggregated in SQL from its completed
 * working sets (warm-ups and sets without load or reps left out).
 */
export interface SessionPerf {
  sessionId: string;
  date: Date;
  /** Heaviest load (0 = bodyweight) and the most reps done with it. */
  topKg: number;
  topReps: number;
  /** Best reliable e1RM (≤ 10 reps, load > 0) and the set that gives it. */
  e1rmKg: number | null;
  e1rmSetKg: number | null;
  e1rmSetReps: number | null;
  /** Most reps in one set (seconds, for a hold), and that set's load. */
  bestReps: number;
  bestRepsKg: number;
  totalReps: number;
  volumeKg: number;
  sets: number;
}

/**
 * What an exercise's progress is measured in:
 * - "load": kilos (and e1RM when the sets allow it);
 * - "reps": a bodyweight exercise done without load — its best set's reps;
 * - "time": a hold without load — its best set's seconds;
 * - "loaded-time": a hold with a load (Pinça de Anilha) — load, then seconds.
 */
export type ProgressMode = "load" | "reps" | "time" | "loaded-time";

export function progressMode(points: Pick<SessionPerf, "topKg">[], opts: { bodyweight: boolean; timed: boolean }): ProgressMode {
  const loaded = points.filter((p) => p.topKg > 0).length;
  const mostlyLoaded = points.length > 0 && loaded * 2 >= points.length;
  if (opts.timed) return mostlyLoaded ? "loaded-time" : "time";
  // A bodyweight exercise with an occasional vest stays a reps exercise; any
  // other exercise with a load is measured in kilos.
  if (opts.bodyweight) return mostlyLoaded ? "load" : "reps";
  return loaded > 0 ? "load" : "reps";
}

export type ProgressMetric = "e1rm" | "reps-at-load" | "load" | "reps" | "time" | "time-at-load";

export interface ProgressComparison {
  metric: ProgressMetric;
  /** Relative change, first → last (0.08 = +8%). */
  pct: number;
  /** "+8%", "−3%" — or "manutenção" when it rounds to 0%. */
  pctText: string;
  direction: "up" | "flat" | "down";
  /** The two sessions in the metric's words: "60 kg × 8 → 65 kg × 6", "+1 rep com 60 kg", "10 → 12 reps". */
  detail: string;
  /** The value each session is plotted by, for a sparkline of the same metric. */
  valueOf: (p: SessionPerf) => number | null;
}

const EPS = 1e-6;
const MINUS = "−";

function signed(n: number, word: (abs: number) => string) {
  return `${n > 0 ? "+" : MINUS}${word(Math.abs(n))}`;
}

function direction(pct: number): { direction: ProgressComparison["direction"]; pctText: string } {
  const whole = Math.round(pct * 100);
  if (whole === 0) return { direction: "flat", pctText: "manutenção" };
  return { direction: whole > 0 ? "up" : "down", pctText: `${whole > 0 ? "+" : MINUS}${Math.abs(whole)}%` };
}

const reps = (n: number) => plural(n, "rep", "reps");
const secs = (n: number) => `${formatNumber(n, 0)} s`;

/**
 * How an exercise moved between two sessions (the first and the latest of a
 * period), in the fairest number available:
 * - with a load: the e1RM when both sessions have one (≤ 10 reps) — 65 × 6
 *   after 60 × 8 is progress even though the reps fell; else, at the same
 *   top load, the reps done with it ("+1 rep com 60 kg"); else the load;
 * - bodyweight: the best set's reps; a hold: its seconds (at the same load,
 *   for a loaded hold).
 * Null when either session has nothing to compare (no load in "load" mode).
 */
export function compareSessions(first: SessionPerf, last: SessionPerf, mode: ProgressMode): ProgressComparison | null {
  if (mode === "reps" || mode === "time") {
    if (!(first.bestReps > 0) || !(last.bestReps > 0)) return null;
    const pct = (last.bestReps - first.bestReps) / first.bestReps;
    const unit = mode === "time" ? secs : reps;
    const bare = (n: number) => formatNumber(n, 0);
    return {
      metric: mode,
      pct,
      ...direction(pct),
      detail: `${bare(first.bestReps)} → ${unit(last.bestReps)}`,
      valueOf: (p) => (p.bestReps > 0 ? p.bestReps : null),
    };
  }
  if (!(first.topKg > 0) || !(last.topKg > 0)) return null;
  const sameLoad = Math.abs(first.topKg - last.topKg) < EPS;
  const timed = mode === "loaded-time";
  if (!timed && first.e1rmKg != null && last.e1rmKg != null && first.e1rmKg > 0) {
    const pct = (last.e1rmKg - first.e1rmKg) / first.e1rmKg;
    return {
      metric: "e1rm",
      pct,
      ...direction(pct),
      detail: `${formatSet(first.e1rmSetKg, first.e1rmSetReps)} → ${formatSet(last.e1rmSetKg, last.e1rmSetReps)}`,
      valueOf: (p) => p.e1rmKg,
    };
  }
  if (sameLoad && first.topReps > 0) {
    const pct = (last.topReps - first.topReps) / first.topReps;
    const diff = last.topReps - first.topReps;
    const unit = timed ? secs : reps;
    return {
      metric: timed ? "time-at-load" : "reps-at-load",
      pct,
      ...direction(pct),
      detail:
        diff === 0
          ? `${formatSet(last.topKg, last.topReps, { timed })} de novo`
          : `${signed(diff, unit)} com ${formatKg(last.topKg)}`,
      valueOf: (p) => (Math.abs(p.topKg - last.topKg) < EPS ? p.topReps : null),
    };
  }
  const pct = (last.topKg - first.topKg) / first.topKg;
  return {
    metric: "load",
    pct,
    ...direction(pct),
    detail: `${formatSet(first.topKg, first.topReps, { timed })} → ${formatSet(last.topKg, last.topReps, { timed })}`,
    valueOf: (p) => (p.topKg > 0 ? p.topKg : null),
  };
}

/** The sessions a comparison can use in a mode: with a load in "load"/"loaded-time", every one otherwise. */
export function comparable(points: SessionPerf[], mode: ProgressMode): SessionPerf[] {
  return mode === "load" || mode === "loaded-time" ? points.filter((p) => p.topKg > 0) : points;
}

/** A session's best set as the lists print it: "65 kg × 6", "PC × 12", "45 s", "10 kg × 30 s". */
export function bestSetText(p: SessionPerf, mode: ProgressMode): string {
  const timed = mode === "time" || mode === "loaded-time";
  // A bodyweight set reads "PC × 12" (peso corporal) where sets are listed one under another.
  if (mode === "reps" && p.bestRepsKg === 0) return `PC\u00a0${formatSet(0, p.bestReps)}`;
  if (mode === "reps" || mode === "time") return formatSet(p.bestRepsKg, p.bestReps, { timed });
  return formatSet(p.topKg, p.topReps, { timed });
}

/** Order for "Evolução por exercício": biggest relative gains first, then maintenance, then drops. */
export function byGain<T extends { comparison: ProgressComparison; namePt: string }>(a: T, b: T): number {
  return b.comparison.pct - a.comparison.pct || a.namePt.localeCompare(b.namePt, "pt-BR");
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export interface RecordRow {
  kind: string;
  value: number;
  weightKg: number | null;
  reps: number | null;
}

/**
 * One record as a label and a value: "Carga máxima" / "62,5 kg", "1RM est." /
 * "79,2 kg", "Repetições" / "13 reps com 60 kg" — bodyweight: "Repetições ·
 * peso corporal" / "15 reps" (Today's form: the value stays as short as a
 * loaded one, so it never crowds its label on a phone). A hold's rep record is
 * time ("Tempo" / "30 s com 10 kg") and its e1RM means nothing (null).
 */
export function describePr(r: RecordRow, timed = false): { label: string; value: string } | null {
  switch (r.kind) {
    case "MAX_WEIGHT":
      return { label: "Carga máxima", value: formatKg(r.value) };
    case "ESTIMATED_1RM":
      return timed ? null : { label: "1RM est.", value: formatKg(r.value) };
    case "MAX_REPS_AT_WEIGHT": {
      const n = r.reps ?? r.value;
      if (timed) return { label: "Tempo", value: r.weightKg ? `${secs(n)} com ${formatKg(r.weightKg)}` : secs(n) };
      return r.weightKg
        ? { label: "Repetições", value: `${reps(n)} com ${formatKg(r.weightKg)}` }
        : { label: "Repetições · peso corporal", value: reps(n) };
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Weeks on target
// ---------------------------------------------------------------------------

/**
 * One São Paulo Monday-start week as "semanas na meta" counts it — a row of
 * the weekly streak's own input (lib/data/streak-weeks), so Progress, Today
 * and the summary never disagree about a week.
 */
export interface LedgerWeek {
  /** Workouts the week's target counts (as Today counts them). */
  done: number;
  target: number;
  /** The week counts: target met, or a deload week with any workout (lib/training/streak). */
  met: boolean;
  /**
   * A short first week (the user's first week of training): it counts only
   * when met, never against.
   */
  partial: boolean;
  /** The week in progress: it counts once met and never before. */
  current: boolean;
}

export type Consistency =
  | { state: "not-started" }
  /** The user's first or second week: too early for a ratio ("Primeira semana"). */
  | { state: "early"; week: 1 | 2 }
  | { state: "ratio"; met: number; total: number };

/**
 * "Semanas na meta": of the weeks in the window, how many reached their
 * target. A short first week and this week count only once met, never
 * against. The ratio shows from the user's third week — two weeks behind
 * them, however the first one went (it being short never delays the ratio).
 */
export function summarizeConsistency(weeks: LedgerWeek[], started: boolean): Consistency {
  if (!started) return { state: "not-started" };
  let met = 0;
  let total = 0;
  let behind = 0;
  for (const w of weeks) {
    if (!w.current) behind += 1;
    if (w.current || w.partial) {
      if (w.met) {
        met += 1;
        total += 1;
      }
      continue;
    }
    total += 1;
    if (w.met) met += 1;
  }
  if (behind < 2) return { state: "early", week: behind === 0 ? 1 : 2 };
  return { state: "ratio", met, total };
}

/** One week of the streak's rows as Progress and the history read them (progress.ts getWeekRows). */
export interface WeekRow {
  /** Monday of the week (São Paulo day number). */
  monday: number;
  enrollmentId: string | null;
  done: number;
  target: number;
  /** The week counts: target met, or a planned deload week with any workout. */
  met: boolean;
  /** A planned deload week (its target doesn't apply: any workout counts). */
  deload: boolean;
  /** This week (the last row). */
  current: boolean;
  trained: boolean;
  /** A program's Thursday–Sunday entry week (the streak's neutral week): it counts only when met, never against. */
  neutral?: boolean;
  /** Monday-first offsets (0–6) of the São Paulo days with a counted workout (getWeekRows). */
  days?: number[];
}

/** Full weeks a period spans, for "semanas na meta" (null: since the start). */
const PERIOD_WEEKS: Record<ProgressPeriod, number | null> = { "4w": 4, "8w": 8, "3m": 13, "6m": 26, "1y": 52, all: null };

const DAY_MS = 86_400_000;

/** 00:00 (São Paulo) of a day number. */
export function dateOfDayNumber(dayNo: number): Date {
  const d = new Date(dayNo * DAY_MS);
  return zonedMidnight(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Where a period starts: 00:00 (São Paulo) of the Monday that opens its first
 * full week — the period's last 4, 8, 13… full weeks plus this one, the very
 * weeks "semanas na meta" reads (consistencyOf). Every number on Progress
 * (workouts done, records, Evolução) and an exercise's history then covers
 * the same span as the weeks on target. Null: since the start.
 */
export function periodStartDate(period: ProgressPeriod, now: Date = new Date()): Date | null {
  const weeks = PERIOD_WEEKS[period];
  return weeks == null ? null : dateOfDayNumber(mondayOf(dayNumberOf(now)) - weeks * 7);
}

/**
 * "Semanas na meta" for a period, from the streak's rows (the week of the
 * user's first workout → this week): the period's last full weeks (4, 8,
 * 13…) — never before the first workout, whose week counts only once met (it
 * is usually short) — and this week once met. The user's first two weeks show
 * no ratio yet (summarizeConsistency).
 */
export function consistencyOf(rows: WeekRow[], period: ProgressPeriod): Consistency & { since: Date | null } {
  if (!rows.some((r) => r.trained)) return { state: "not-started", since: null };
  const weeksBack = PERIOD_WEEKS[period];
  const complete = rows.slice(0, -1);
  const window = weeksBack == null ? complete : complete.slice(-weeksBack);
  const weeks: LedgerWeek[] = [...window, rows[rows.length - 1]].map((r) => ({
    ...r,
    partial: r.neutral === true || (r.monday === rows[0].monday && !r.current),
  }));
  const first = window[0] ?? rows[rows.length - 1];
  return { ...summarizeConsistency(weeks, true), since: dateOfDayNumber(first.monday) };
}

// ---------------------------------------------------------------------------
// Trends (W-085): workouts per week and sets per muscle
// ---------------------------------------------------------------------------

/** One column of "Treinos por semana": a streak week (WeekRow) with its trained São Paulo days. */
export interface WeekColumn extends WeekRow {
  /** Monday-first offsets (0 = Monday … 6 = Sunday) of the days with a counted workout. */
  days: number[];
}

export interface WeekColumns {
  /** Oldest → newest; the last one is this week. */
  columns: WeekColumn[];
  /** Average workouts in the complete weeks shown ("4,4"); null without one. */
  avgDone: string | null;
  /** The target: "5", or "3–5" when it changed along the way. */
  targetText: string;
  completeWeeks: number;
  /** Complete weeks that counted (met, or a deload week with a workout). */
  metWeeks: number;
}

/**
 * The weeks "Treinos por semana" draws for a period: its full weeks and this
 * one (4 weeks → 5 columns; "Tudo" → every week the streak reads, ≤ 58).
 * The rows start at the week of the first workout, so no empty weeks come
 * before it. The average counts complete weeks only (this week is never
 * judged mid-way).
 */
export function weekColumns(rows: readonly WeekRow[], period: ProgressPeriod): WeekColumns {
  const weeks = PERIOD_WEEKS[period];
  const columns = (weeks == null ? rows : rows.slice(-(weeks + 1))).map((r) => ({ ...r, days: r.days ?? [] }));
  const complete = columns.filter((c) => !c.current);
  const avg = complete.length > 0 ? complete.reduce((n, c) => n + c.done, 0) / complete.length : null;
  const targets = columns.map((c) => c.target);
  const lo = Math.min(...targets);
  const hi = Math.max(...targets);
  return {
    columns,
    avgDone: avg == null ? null : formatNumber(avg, 1),
    targetText: targets.length === 0 ? "" : lo === hi ? String(lo) : `${lo}–${hi}`,
    completeWeeks: complete.length,
    metWeeks: complete.filter((c) => c.met).length,
  };
}

/** One muscle group's working sets in one São Paulo week (lib/data/progress getMuscleWeeks). */
export interface MuscleWeekRow {
  monday: number;
  key: string;
  /** Direct sets plus half of the assisting ones. */
  sets: number;
  /** Sets where it is a prime mover. */
  direct: number;
}

export interface MuscleVolume {
  /** All 10 groups, in the builder's order (VOLUME_MUSCLES). */
  rows: VolumeRow[];
  /** What the numbers average: n complete weeks, this week so far ("parcial"), or nothing yet. */
  basis: { weeks: number } | "parcial" | null;
}

/**
 * "Séries por músculo": each group's weekly working sets, averaged over the
 * complete weeks shown that were trained — never a deload week (light on
 * purpose) nor a program's entry week (short on purpose). Without such a
 * week yet, this week's sets so far ("parcial"). Rounded to half a set, and
 * judged against the builder's 10–20 guide (weekly-volume volumeStatus).
 */
export function muscleVolume(muscleRows: readonly MuscleWeekRow[], columns: readonly WeekColumn[]): MuscleVolume {
  const counted = columns.filter((c) => !c.current && c.trained && !c.deload && !c.neutral).map((c) => c.monday);
  const current = columns.find((c) => c.current);
  const partial = counted.length === 0 && current?.trained === true;
  const mondays = new Set(partial && current ? [current.monday] : counted);
  const weeks = mondays.size;
  const sum = (key: string, field: "sets" | "direct") =>
    muscleRows.filter((r) => r.key === key && mondays.has(r.monday)).reduce((n, r) => n + r[field], 0);
  const half = (n: number) => Math.round(n * 2) / 2;
  const rows = VOLUME_MUSCLES.map((m) => {
    const sets = weeks > 0 ? half(sum(m.key, "sets") / weeks) : 0;
    return {
      key: m.key,
      label: m.label,
      sets,
      direct: weeks > 0 ? half(sum(m.key, "direct") / weeks) : 0,
      status: volumeStatus(sets),
    };
  });
  return { rows, basis: weeks === 0 ? null : partial ? "parcial" : { weeks } };
}
