import { GD_SERIES, isPartialEntryWeek } from "./program-calendar";
import { weekCounts, type StreakWeek } from "./streak";
import { startOfWeek, wallClock } from "./week";

/**
 * A program's week-by-week guidance (WorkoutTemplate.weeklyGuidance, copied
 * onto UserProgram at activation): the week's RIR target, what to focus on
 * and how many sets. Pure helpers that read it for the week the user is in —
 * Today's "SEMANA 5 DE 13 · RIR ALVO 1" and the workout's "Sem. 5 · alvo RIR 1".
 */

export interface WeekGuidance {
  week: number;
  /** The week's target reps in reserve (the wave: 3, 2.5, … 1, then a deload/test). */
  rirTarget: number | null;
  notePt: string | null;
  setsNotePt: string | null;
}

export interface WeekGuidanceView extends WeekGuidance {
  /** A planned lighter week (deload/descarga): any training counts toward the streak. */
  deload: boolean;
  /** A GD block's last week: the benchmark test. */
  test: boolean;
}

const text = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);

/** The guidance JSON as a list of weeks, ignoring anything malformed. */
export function parseWeeklyGuidance(json: unknown): WeekGuidance[] {
  if (!Array.isArray(json)) return [];
  const out: WeekGuidance[] = [];
  for (const raw of json) {
    if (!raw || typeof raw !== "object") continue;
    const g = raw as Record<string, unknown>;
    const week = Number(g.week);
    if (!Number.isInteger(week) || week < 1) continue;
    const rir = g.rirTarget == null ? null : Number(g.rirTarget);
    out.push({
      week,
      rirTarget: rir != null && Number.isFinite(rir) && rir >= 0 ? rir : null,
      notePt: text(g.notePt),
      setsNotePt: text(g.setsNotePt),
    });
  }
  return out.sort((a, b) => a.week - b.week);
}

/**
 * The week *is* a deload — not a conditional mention ("2+ gatilhos → a semana
 * 7 vira deload", "antes do deload", "se a 7 foi deload"). The templates say
 * it by opening a sentence with it ("Deload: …", "DELOAD PLANEJADO", "Seg-qua:
 * deload —", "Descarga: …", "Descarga final") or naming the week so ("Semana
 * de descarga", "Semana leve (deload)", "Semana única de deload", "Semana leve
 * planejada", "Mini-descarga", "Semana de consolidação: reduza para 2 séries").
 */
const DELOAD_STATEMENT = [
  // "2+ gatilhos: deload agora" is a condition, not the plan.
  /(?:^|[.:;]\s*)(?:deload|descarga)\b(?!\s+(?:se|caso|quando|agora)\b)/i,
  /\bsemana\s+(?:única\s+|leve\s+)?(?:de\s+)?(?:deload|descarga)\b/i,
  /\(deload\)/i,
  /\bmini-?descarga\b/i,
  /\bsemana\s+leve\s+planejada\b/i,
  // A lighter week under another name: fewer sets on purpose.
  /\bsemana\s+de\s+consolidação\s*:\s*(?:reduza|corte)\b/i,
];
/** "Começa a onda 2 (regra do ano 1, não é deload)". */
const NOT_A_DELOAD = /\bnão\s+é\s+(?:deload|descarga)\b/i;

export function isDeloadGuidance(g: Pick<WeekGuidance, "notePt" | "setsNotePt">): boolean {
  const texts = [g.setsNotePt, g.notePt].filter((t): t is string => t != null);
  if (texts.some((t) => NOT_A_DELOAD.test(t))) return false;
  return texts.some((t) => DELOAD_STATEMENT.some((re) => re.test(t)));
}

/**
 * The week's guidance (`week` is the program week counted toward the
 * duration; the entry week reads week 1), flagged as a deload or as a GD
 * block's test week (its last week; the GD Adaptação block ends in a bridge
 * week, not a test). Null when the program has no guidance for it.
 */
export function getWeekGuidance(
  json: unknown,
  week: number,
  program: { templateSlug?: string | null; durationWeeks?: number | null } = {},
): WeekGuidanceView | null {
  const list = parseWeeklyGuidance(json);
  const g = list.find((w) => w.week === Math.max(1, week));
  if (!g) return null;
  const gd = program.templateSlug != null && (GD_SERIES as readonly string[]).includes(program.templateSlug);
  const lastWeek = program.durationWeeks != null && g.week === program.durationWeeks;
  const test = gd && program.templateSlug !== "gd-adaptacao" && lastWeek;
  return { ...g, deload: isDeloadGuidance(g), test };
}

/**
 * The program week the user is training in now — the week a workout started
 * now will be saved in (advanceProgram's rule): the enrollment's counter moves
 * on with the first finished workout of a new calendar week. So on a Monday
 * with nothing done yet this week (and something done before), it's the next one.
 */
export function effectiveProgramWeek(p: {
  currentWeek: number;
  /** Finished workouts (with a working set) of this enrollment in the current calendar week. */
  sessionsThisWeek: number;
  /** Any finished workout of this enrollment before this calendar week. */
  trainedBefore: boolean;
}): number {
  return p.sessionsThisWeek === 0 && p.trainedBefore ? p.currentWeek + 1 : Math.max(1, p.currentWeek);
}

/** Days left in the São Paulo Monday-start week, today included (Thursday → 4, Sunday → 1). */
export function daysLeftInWeek(now: Date): number {
  return 7 - ((wallClock(now).weekday + 6) % 7);
}

/**
 * An entry week's target (a program activated Thursday–Sunday): the plan's
 * week, capped at the days from the activation day to Sunday — Thursday 4,
 * Sunday 1. Fixed at activation: it doesn't shrink as the week goes by. The
 * one rule for Today's meter, the summary's and the streak's week
 * (streak-weeks), so a week is never "done" on one screen and short on another.
 */
export function entryWeekTarget(planTarget: number, startedAt: Date): number {
  return Math.max(1, Math.min(planTarget, daysLeftInWeek(startedAt)));
}

export type ProgramWeekView =
  | {
      /** A Thursday–Sunday start (program-calendar isPartialEntryWeek): not counted toward the duration. */
      kind: "entry";
      /** Days left this week, today included (the "N dias restantes" line). */
      daysLeft: number;
      /** Days from the activation day to Sunday: the cap on the week's target (entryWeekTarget). */
      cap: number;
      /** Guidance week to follow (week 1). */
      guidanceWeek: 1;
    }
  | {
      kind: "week";
      /** Program week counted toward the duration (1-based). */
      week: number;
      guidanceWeek: number;
    };

/**
 * Where the enrollment stands this week. The entry week is the calendar week
 * of a Thursday–Sunday activation, while it lasts; afterwards the program
 * weeks count from the first full week. An entry week with no workout in it
 * never moved the counter, so nothing is subtracted for it.
 */
export function programWeekView(p: {
  startedAt: Date;
  now: Date;
  effectiveWeek: number;
  /** A workout of this enrollment was finished during its entry week. */
  entryWeekTrained: boolean;
}): ProgramWeekView {
  const partial = isPartialEntryWeek(p.startedAt);
  if (partial && startOfWeek(p.now).getTime() === startOfWeek(p.startedAt).getTime()) {
    return { kind: "entry", daysLeft: daysLeftInWeek(p.now), cap: daysLeftInWeek(p.startedAt), guidanceWeek: 1 };
  }
  const week = Math.max(1, p.effectiveWeek - (partial && p.entryWeekTrained ? 1 : 0));
  return { kind: "week", week, guidanceWeek: week };
}

export interface ThisWeekRule {
  /** planWeek's targetCap: the entry week's (days from the activation day to Sunday); null outside one. */
  targetCap: number | null;
  /**
   * The entry week of a program started in a calendar week that already
   * counts — its target met through another enrollment (the block just
   * finished, the program switched from): it's complete. Nothing is asked
   * of it; the program starts with next week's first day.
   */
  alreadyCounts: boolean;
}

/**
 * How this calendar week is judged for the active enrollment — Today's hero
 * and meter and the summary's "Próximo treino" read it alike. `thisWeek` is
 * the streak's row for the week (streak-weeks: the enrollment it was judged
 * by, and whether it counts).
 */
export function thisWeekRule(p: {
  view: ProgramWeekView | null;
  enrollmentId: string;
  thisWeek: StreakWeek & { enrollmentId: string | null };
}): ThisWeekRule {
  if (p.view?.kind !== "entry") return { targetCap: null, alreadyCounts: false };
  const alreadyCounts = weekCounts(p.thisWeek) && p.thisWeek.enrollmentId != null && p.thisWeek.enrollmentId !== p.enrollmentId;
  return { targetCap: p.view.cap, alreadyCounts };
}

/**
 * planWeek's "done this week" for a week that's already complete
 * (ThisWeekRule.alreadyCounts): every trainable day, so the next workout is
 * next week's first.
 */
export function completeWeekDone(trainableDayIds: readonly string[]): { doneDayIds: Set<string>; sessionCount: number } {
  return { doneDayIds: new Set(trainableDayIds), sessionCount: Number.MAX_SAFE_INTEGER };
}

// ---------------------------------------------------------------------------
// The week's RIR on each exercise (W-054)
// ---------------------------------------------------------------------------

/**
 * The RIR a program's own per-exercise targets are written at: the middle of
 * its wave — the lower median of its weeks' targets, deload weeks aside (the
 * lower one: between two, the week reads as the easier). GD 1's wave (3, 2.5,
 * 2.5, 2, 1, 1, …) sits at 2: its exercises' 3 / 2.5 / 2 (free weights /
 * machines / isolations) are the middle weeks' effort. Null without a wave.
 */
export function baselineRir(json: unknown): number | null {
  const weeks = parseWeeklyGuidance(json).filter((w) => w.rirTarget != null);
  const regular = weeks.filter((w) => !isDeloadGuidance(w));
  const pool = (regular.length > 0 ? regular : weeks).map((w) => w.rirTarget as number).sort((a, b) => a - b);
  return pool.length > 0 ? pool[Math.floor((pool.length - 1) / 2)] : null;
}

/** What the week's RIR needs to know about an exercise to move its target safely. */
export interface RirExercise {
  /** A free-weight compound (barbell/dumbbell/kettlebell press, squat, hinge, row). */
  freeWeightCompound: boolean;
  /** The program exercise's notes: "nunca à falha (mín. RIR 2)", "Sem. 5-6: mín. RIR 1". */
  notes: string | null;
  /** A timed hold: its effort isn't moved by the week. */
  timed: boolean;
}

/** The wave never prescribes failure: the "last set to failure" calls stay in the week's instructions. */
const WAVE_MIN_RIR = 1;
/** Free-weight compounds are never taken below RIR 2 by the wave ("pesos livres nunca à falha"). */
export const FREE_WEIGHT_COMPOUND_MIN_RIR = 2;
/** A lighter week raises targets up to RIR 4 (a deload's "RIR 3-4"), never past what the program asks. */
const WAVE_MAX_RIR = 4;
const MIN_RIR_NOTE = /\bm[ií]n(?:imo|\.)?\s*(?:de\s+)?RIR\s*(\d+(?:[.,]\d+)?)/i;

/**
 * The lowest RIR the wave may take an exercise to: 1 (never failure), 2 for a
 * free-weight compound, or what its notes say ("mín. RIR 2") — but never
 * above the exercise's own target: a program that asks for less gets it.
 */
export function rirFloor(exerciseRir: number, exercise: RirExercise): number {
  let floor = WAVE_MIN_RIR;
  const min = exercise.notes?.match(MIN_RIR_NOTE);
  if (min) floor = Math.max(floor, Number(min[1].replace(",", ".")));
  if (exercise.freeWeightCompound) floor = Math.max(floor, FREE_WEIGHT_COMPOUND_MIN_RIR);
  return Math.min(exerciseRir, floor);
}

/**
 * The RIR an exercise aims for in a program week (W-054). The program's wave
 * moves every exercise's own target by the same step — how far this week's
 * RIR sits from the program's baseline (baselineRir) — so the differences
 * the program wrote between exercises stay: in GD 1's week 5 (wave 1, baseline
 * 2) the bench press (3) goes to 2, a machine compound (2.5) to 1.5, an
 * isolation (2) to 1 — what the week's own note prescribes. A harder week
 * never takes an exercise below its floor (rirFloor: the bench's "mín. RIR 2");
 * a lighter one raises it to RIR 4 at most. Timed holds, exercises without
 * RIR and programs without a wave keep the exercise's own target. Half reps.
 */
export function weekRirTarget(
  exerciseRir: number | null,
  week: Pick<WeekGuidance, "rirTarget"> | null,
  program: { baseline: number | null; exercise?: RirExercise } = { baseline: null },
): number | null {
  if (exerciseRir == null) return null;
  const weekRir = week?.rirTarget ?? null;
  if (weekRir == null || program.baseline == null || program.exercise?.timed) return exerciseRir;
  const shifted = exerciseRir + (weekRir - program.baseline);
  const floor = rirFloor(exerciseRir, program.exercise ?? { freeWeightCompound: false, notes: null, timed: false });
  const cap = Math.max(exerciseRir, WAVE_MAX_RIR);
  return Math.round(Math.min(cap, Math.max(floor, shifted)) * 2) / 2;
}
