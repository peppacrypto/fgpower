import { isPartialEntryWeek } from "@/lib/training/program-calendar";
import { startOfWeek } from "@/lib/training/week";
import { effectiveProgramWeek } from "@/lib/training/week-guidance";
import { parseWeekTargetSnapshot, type WeekTargetSnapshot } from "@/lib/training/week-target";

/**
 * Where a program block stands — "Semana 3 de 13 · 18 de 65 treinos (92%
 * aderência)" — from its enrollment and the workouts done in it. Pure.
 *
 * - Weeks: the enrollment's week counter, less a short entry week (a program
 *   activated Thursday–Sunday starts that day, but that week doesn't count
 *   toward the duration: program-calendar.ts) — subtracted only when a workout
 *   was done in it, since only then did it take a number (countedWeeks) —
 *   never past the duration.
 * - Workouts done: per program week, distinct days (a redo of a day already
 *   done that week isn't another workout of the plan) — or every session for
 *   a plan that repeats its days (A/B at 3×) — capped at the week's target.
 *   Entry-week workouts are extra: they aren't part of the planned count.
 * - Adherence: workouts done over what the weeks trained so far asked for;
 *   the week in progress asks only for what's been done in it, so the number
 *   never drops just because the week isn't over. Weeks without training
 *   don't advance the counter (advanceProgram), so a break is never a "0%".
 */

/**
 * The Monday (00:00, São Paulo) a Thursday–Sunday activation's entry week
 * ends on; null for a program activated Monday–Wednesday (no entry week).
 */
export function entryWeekEnd(startedAt: Date): Date | null {
  if (!isPartialEntryWeek(startedAt)) return null;
  // Midweek of the next calendar week, back to its Monday: exact across any clock change.
  return startOfWeek(new Date(startOfWeek(startedAt).getTime() + 10 * 86_400_000));
}

/** Whether `at` is still in the enrollment's entry week (a Thursday–Sunday activation's own calendar week). */
export function inEntryWeek(startedAt: Date, at: Date): boolean {
  const end = entryWeekEnd(startedAt);
  return end !== null && at < end;
}

/** The counter steps a trained entry week took (0 or 1). */
function entryOffset(startedAt: Date, entryWeekTrained: boolean): number {
  return entryWeekTrained && isPartialEntryWeek(startedAt) ? 1 : 0;
}

/**
 * Program weeks that count toward the duration, from the enrollment's week
 * counter. The counter starts at 1 and moves on with the first workout of a
 * later calendar week (advanceProgram), so a Thursday–Sunday entry week only
 * took a number if a workout was done in it: it is subtracted only then —
 * activated Friday and first trained on Monday, that Monday is week 1. The
 * same rule as Today's (week-guidance programWeekView, streak-weeks
 * entryWeekTrained).
 */
export function countedWeeks(currentWeek: number, startedAt: Date, entryWeekTrained: boolean): number {
  return Math.max(0, currentWeek - entryOffset(startedAt, entryWeekTrained));
}

/**
 * The program week an enrollment stands at now — Today's rule
 * (week-guidance effectiveProgramWeek), so Progress, Programs, the archive
 * and switch warnings never lag a week behind it: the week a workout started
 * now counts in. The counter moves on with the first workout of a calendar
 * week, so a week with nothing done yet (every Monday, and after "Retomar")
 * already reads as the next one. 0 while the entry week lasts; from the
 * Monday after it, at least week 1. Callers clamp it to the duration.
 */
export function programWeekNow(p: {
  currentWeek: number;
  startedAt: Date;
  entryWeekTrained: boolean;
  now: Date;
  /** Finished workouts of the enrollment in the calendar week of `now`. */
  sessionsThisWeek: number;
  /** Any finished workout of the enrollment before that week. */
  trainedBefore: boolean;
}): number {
  if (inEntryWeek(p.startedAt, p.now)) return 0;
  const effective = effectiveProgramWeek({
    currentWeek: p.currentWeek,
    sessionsThisWeek: p.sessionsThisWeek,
    trainedBefore: p.trainedBefore,
  });
  return Math.max(1, countedWeeks(effective, p.startedAt, p.entryWeekTrained));
}

/**
 * Whether the workout just counted ends the block: its week counter went past
 * the block's last week (the first workout of a later week), or it was the
 * last week and every workout of that week is now done.
 */
export function blockEnds(p: {
  week: number;
  startedAt: Date;
  durationWeeks: number | null;
  weekComplete: boolean;
  /** A workout of the enrollment was finished in its entry week (this one included). */
  entryWeekTrained: boolean;
}): boolean {
  if (!p.durationWeeks || p.durationWeeks < 1) return false;
  const counted = countedWeeks(p.week, p.startedAt, p.entryWeekTrained);
  return counted > p.durationWeeks || (counted === p.durationWeeks && p.weekComplete);
}

export interface ResumePoint {
  /** The program week the next workout counts in: "Retomar da semana N". */
  week: number;
  /** The week counter to resume the enrollment with. */
  currentWeek: number;
}

/**
 * Where a stopped block picks up ("Retomar da semana 6"): the program week
 * its next workout will count in — the same week when the last workout was
 * done this calendar week, the next one otherwise (advanceProgram starts a
 * program week with the first workout of a calendar week) — at least week 1.
 *
 * Never past the duration: a block stopped in its last week and picked up in
 * a later calendar week would otherwise start, with its next workout, a week
 * it doesn't have (and the calendar would close it as soon as it's resumed).
 * It resumes at its last week instead, with the counter one step back, so
 * that workout counts in the last week again and the block ends as any other
 * does: with that week done, or on the Monday after it.
 */
export function resumePoint(p: {
  currentWeek: number;
  startedAt: Date;
  durationWeeks: number | null;
  /** The last finished workout was done in the current calendar week. */
  trainedThisWeek: boolean;
  entryWeekTrained: boolean;
}): ResumePoint {
  const raw = p.trainedThisWeek ? p.currentWeek : p.currentWeek + 1;
  const week = Math.max(1, countedWeeks(raw, p.startedAt, p.entryWeekTrained));
  const weeks = p.durationWeeks && p.durationWeeks > 0 ? p.durationWeeks : null;
  if (weeks === null || week <= weeks) return { week, currentWeek: p.currentWeek };
  // The counter value of the block's last week: the next workout lands on it.
  const last = weeks + entryOffset(p.startedAt, p.entryWeekTrained);
  return { week: weeks, currentWeek: p.trainedThisWeek ? last : last - 1 };
}

export interface BlockSession {
  /** The enrollment's week counter when the workout was done (raw: a trained entry week is 1). */
  programWeek: number | null;
  programDayId: string | null;
  /** When it was finished: a workout in the entry week makes that week take a number. */
  finishedAt: Date | null;
  /** The week's plan as trained (frozen at advanceProgram): editing the program later must not re-judge past weeks. Raw JSON; null = read the live plan. */
  weekTargetSnapshot?: unknown;
}

export interface BlockProgressInput {
  /** The enrollment's week counter (raw). */
  currentWeek: number;
  startedAt: Date;
  durationWeeks: number | null;
  daysPerWeek: number;
  /** Days the program has (repeats are inferred when daysPerWeek is higher). */
  dayCount: number;
  sessions: readonly BlockSession[];
  /**
   * For a running block: the week it stands at now (programWeekNow — Today's
   * rule: a week with nothing done yet already reads as the next one; the
   * entry week only while it lasts). Left out for a finished one, read from
   * its counter.
   */
  now?: Date;
}

export interface BlockProgress {
  /** In the short entry week, before program week 1. */
  entryWeek: boolean;
  /** Program week (1-based, entry week excluded), clamped to the duration; 0 in the entry week. */
  week: number;
  weeks: number | null;
  sessionsDone: number;
  plannedSessions: number | null;
  /** Rounded percentage; null until a counted week has any workout. */
  adherencePct: number | null;
}

/** The sessions of a plan's week: distinct days, or every session where the plan repeats its days. */
function weekCount(sessions: readonly BlockSession[], repeats: boolean): number {
  if (repeats) return sessions.length;
  const ids = new Set<string>();
  let unlinked = 0;
  for (const s of sessions) {
    if (s.programDayId) ids.add(s.programDayId);
    else unlinked += 1;
  }
  return ids.size + unlinked;
}

/** The plan a block week was trained under, from its latest finished workout's frozen snapshot (null: none stamped). */
function frozenBlockPlan(sessions: readonly BlockSession[]): WeekTargetSnapshot | null {
  let latest: { at: number; snap: WeekTargetSnapshot } | null = null;
  for (const s of sessions) {
    const snap = parseWeekTargetSnapshot(s.weekTargetSnapshot);
    if (!snap) continue;
    const at = s.finishedAt ? +s.finishedAt : 0;
    if (!latest || at >= latest.at) latest = { at, snap };
  }
  return latest?.snap ?? null;
}

export function blockProgress(p: BlockProgressInput): BlockProgress {
  const entryWeekTrained = p.sessions.some((s) => s.finishedAt != null && inEntryWeek(p.startedAt, s.finishedAt));
  const offset = entryOffset(p.startedAt, entryWeekTrained);
  let counted = countedWeeks(p.currentWeek, p.startedAt, entryWeekTrained);
  if (p.now) {
    const weekStart = startOfWeek(p.now);
    counted = programWeekNow({
      currentWeek: p.currentWeek,
      startedAt: p.startedAt,
      entryWeekTrained,
      now: p.now,
      sessionsThisWeek: p.sessions.filter((s) => s.finishedAt != null && s.finishedAt >= weekStart && s.finishedAt <= (p.now as Date)).length,
      trainedBefore: p.sessions.some((s) => s.finishedAt != null && s.finishedAt < weekStart),
    });
  }
  const weeks = p.durationWeeks && p.durationWeeks > 0 ? p.durationWeeks : null;
  const liveRepeats = p.daysPerWeek > p.dayCount;
  const liveTarget = Math.max(1, p.daysPerWeek);
  // The last program week of the block reached so far; past the duration the block is over.
  const week = weeks !== null ? Math.min(counted, weeks) : counted;
  const over = weeks !== null && counted > weeks;

  const byWeek = new Map<number, BlockSession[]>();
  for (const s of p.sessions) {
    if (s.programWeek == null) continue;
    const w = s.programWeek - offset;
    if (w < 1 || w > week) continue;
    const list = byWeek.get(w) ?? [];
    list.push(s);
    byWeek.set(w, list);
  }
  // Each week keeps the plan it was trained under (frozen on its workouts);
  // weeks not yet trained, and pre-snapshot rows, read the live plan — so
  // raising or lowering the frequency never rewrites a finished week's count
  // or "N de M treinos" (spec A-001).
  const planOf = (w: number): { target: number; repeats: boolean } => {
    const snap = frozenBlockPlan(byWeek.get(w) ?? []);
    return snap
      ? { target: Math.max(1, snap.daysPerWeek), repeats: snap.daysPerWeek > snap.dayCount }
      : { target: liveTarget, repeats: liveRepeats };
  };
  const doneIn = (w: number) => {
    const plan = planOf(w);
    return Math.min(plan.target, weekCount(byWeek.get(w) ?? [], plan.repeats));
  };
  let done = 0;
  for (let w = 1; w <= week; w++) done += doneIn(w);
  // Weeks behind ask for their full (frozen) target; the week in progress only for what it has.
  let asked = 0;
  for (let w = 1; w < week; w++) asked += planOf(w).target;
  if (week > 0) asked += over ? planOf(week).target : doneIn(week);
  // Planned = each counted week's frozen target, plus the live target for the weeks still to come.
  let plannedSessions: number | null = null;
  if (weeks !== null) {
    plannedSessions = 0;
    for (let w = 1; w <= weeks; w++) plannedSessions += w <= week ? planOf(w).target : liveTarget;
  }

  return {
    entryWeek: counted === 0,
    week,
    weeks,
    sessionsDone: done,
    plannedSessions,
    adherencePct: asked > 0 ? Math.min(100, Math.round((done / asked) * 100)) : null,
  };
}
