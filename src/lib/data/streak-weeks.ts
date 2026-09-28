import { resolveSessionDay } from "@/lib/training/day-match";
import { dayNumberOf, mondayOf, repeatsDays } from "@/lib/training/day-rotation";
import { isPartialEntryWeek } from "@/lib/training/program-calendar";
import { weekCounts, weeklyStreak, type StreakResult, type StreakWeek } from "@/lib/training/streak";
import { entryWeekTarget, getWeekGuidance } from "@/lib/training/week-guidance";
import { effectiveDeload } from "@/lib/training/deload";

/**
 * The weekly-streak input, built from the user's finished workouts (pure —
 * streak-data.ts loads the rows). One rule for Today and the workout summary:
 *
 * - Weeks are São Paulo Monday-start weeks, from the week of the first
 *   workout in the window up to this one; weeks without a workout are misses.
 * - A week is judged by the program trained in it — the one whose week
 *   counts, when two were (a block finished midweek and the next one
 *   started); else, in a neutral entry week, the program it's the entry week
 *   of (Today's meter: a switch midweek shows the new program's "1/4"); else
 *   the one trained most; else the one running then.
 * - A week's target is its program's: every day with exercises (A/B at
 *   3×/week: the frequency). In a Thursday–Sunday entry week, capped at the
 *   days from the activation day to Sunday (week-guidance entryWeekTarget:
 *   Today's and the summary's rule). Without a program, the profile's days
 *   per week.
 * - A week's count is its program's distinct days (a redo isn't a new
 *   workout; repeats count only where the plan repeats days), as Today's
 *   meter counts them — never cut to an entry week's cap. Without a program,
 *   every workout.
 * - A deload week — planned (its program week's guidance says so) or applied
 *   by the user (lib/training/deload effectiveDeload) — counts with any
 *   workout in it (lib/training/streak); not a calendar week that holds only
 *   a finished block's late workout (lateBlockWorkout).
 * - The entry week of a program activated Thursday–Sunday (and run or
 *   trained past it) is neutral: short of its target, it's never a miss.
 */

export interface StreakSession {
  finishedAt: Date;
  enrollmentId: string | null;
  programDayId: string | null;
  programDayIndex: number | null;
  name: string;
  programWeek: number | null;
}

export interface StreakEnrollment {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
  /** The enrollment's week counter (dates this week's guidance before its first workout). */
  currentWeek?: number;
  /** Weeks the user turned into a deload (São Paulo Monday day numbers). */
  deloadMondays?: number[];
  program: {
    daysPerWeek: number;
    durationWeeks: number | null;
    weeklyGuidance: unknown;
    templateSlug: string | null;
    days: { id: string; dayIndex: number; name: string; exerciseCount: number }[];
  };
}

export interface StreakWeekRow extends StreakWeek {
  /** Monday of the week (São Paulo day number). */
  monday: number;
  done: number;
  target: number;
  /** The enrollment the week is judged by, if any. */
  enrollmentId: string | null;
}

/** The target a program sets for a full week (planWeek's): its trainable days, or the frequency when it repeats days. */
export function programWeekTarget(program: StreakEnrollment["program"]): number {
  const trainable = program.days.filter((d) => d.exerciseCount > 0).length;
  if (trainable === 0) return Math.max(1, program.daysPerWeek);
  return repeatsDays(program.daysPerWeek, program.days.length) ? Math.max(trainable, program.daysPerWeek) : trainable;
}

/** Whether an enrollment's Thursday–Sunday entry week had a workout (it then moved the week counter). */
export function entryWeekTrained(enrollment: Pick<StreakEnrollment, "id" | "startedAt">, sessions: StreakSession[]): boolean {
  if (!isPartialEntryWeek(enrollment.startedAt)) return false;
  const monday = mondayOf(dayNumberOf(enrollment.startedAt));
  return sessions.some((s) => s.enrollmentId === enrollment.id && mondayOf(dayNumberOf(s.finishedAt)) === monday);
}

function weekRow(
  monday: number,
  sessions: StreakSession[],
  enrollments: StreakEnrollment[],
  allSessions: StreakSession[],
  fallbackTarget: number,
  current = false,
): StreakWeekRow {
  const byEnrollment = new Map<string, StreakSession[]>();
  for (const s of sessions) {
    if (!s.enrollmentId) continue;
    byEnrollment.set(s.enrollmentId, [...(byEnrollment.get(s.enrollmentId) ?? []), s]);
  }
  const sunday = monday + 6;
  const active = (e: StreakEnrollment) =>
    dayNumberOf(e.startedAt) <= sunday && (e.endedAt == null || dayNumberOf(e.endedAt) >= monday);
  // Programs activated Thursday–Sunday of this week, still running after it or trained in it (latest first).
  const entries = enrollments
    .filter(
      (e) =>
        isPartialEntryWeek(e.startedAt) &&
        mondayOf(dayNumberOf(e.startedAt)) === monday &&
        (e.endedAt == null || dayNumberOf(e.endedAt) > sunday || byEnrollment.has(e.id)),
    )
    .sort((a, b) => +b.startedAt - +a.startedAt);
  const neutral = entries.length > 0;

  // The programs trained this week, most workouts first; the one whose week counts leads.
  const judged = [...byEnrollment.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .flatMap(([id]) => {
      const e = enrollments.find((x) => x.id === id);
      return e ? [judgeWeek(monday, e, byEnrollment.get(id) ?? [], sessions, allSessions, current)] : [];
    });
  const counting = judged.find((r) => weekCounts(r));
  if (counting) return { ...counting, neutral };
  // A neutral entry week that doesn't count is the new program's, as Today shows it ("Semana de
  // entrada 1/4", not the old program's 2/5 from before the switch): judged by the entry program
  // when it was trained in the week, or — this week — while it's the one running.
  const entry = entries.find((e) => byEnrollment.has(e.id)) ?? (current ? entries.find((e) => e.endedAt == null) : undefined);
  if (entry) {
    return { ...judgeWeek(monday, entry, byEnrollment.get(entry.id) ?? [], sessions, allSessions, current), neutral };
  }
  const row = judged[0];
  if (row) return { ...row, neutral };

  const running = enrollments.filter(active).sort((a, b) => +b.startedAt - +a.startedAt)[0];
  if (running) return { ...judgeWeek(monday, running, [], sessions, allSessions, current), neutral };

  const target = Math.max(1, fallbackTarget);
  return {
    monday,
    done: sessions.length,
    target,
    met: sessions.length >= target,
    trained: sessions.length > 0,
    neutral,
    enrollmentId: null,
  };
}

/** A week judged by one program: its target, its distinct days, and whether its program week is a deload. */
function judgeWeek(
  monday: number,
  e: StreakEnrollment,
  own: StreakSession[],
  weekSessions: StreakSession[],
  allSessions: StreakSession[],
  current: boolean,
): StreakWeekRow {
  const program = e.program;
  const planTarget = programWeekTarget(program);
  const startNo = dayNumberOf(e.startedAt);
  const entryWeek = mondayOf(startNo) === monday && isPartialEntryWeek(e.startedAt);
  const target = entryWeek ? entryWeekTarget(planTarget, e.startedAt) : Math.max(1, planTarget);

  const trainableDays = program.days.filter((d) => d.exerciseCount > 0);
  const distinct = new Set(own.map((s) => resolveSessionDay(s, program.days)?.id ?? `name:${s.name}`)).size;
  const repeats = Math.max(0, Math.min(own.length - distinct, planTarget - trainableDays.length));
  // What the plan counts — never cut to an entry week's cap (two workouts are two, even in a 1-day entry week).
  const done = Math.min(planTarget, distinct + repeats);

  // The program week trained in; this week, before its first workout, the one the next workout will count in.
  let programWeek = Math.max(0, ...own.map((s) => s.programWeek ?? 0));
  if (programWeek === 0 && current && e.currentWeek != null) {
    const trainedBefore = allSessions.some((s) => s.enrollmentId === e.id && dayNumberOf(s.finishedAt) < monday);
    programWeek = e.currentWeek + (trainedBefore ? 1 : 0);
  }
  const offset = isPartialEntryWeek(e.startedAt) && entryWeekTrained(e, allSessions) ? 1 : 0;
  const guidance =
    programWeek > 0
      ? getWeekGuidance(program.weeklyGuidance, programWeek - offset, {
          templateSlug: program.templateSlug,
          durationWeeks: program.durationWeeks,
        })
      : null;
  return {
    monday,
    done,
    target,
    met: done >= target,
    deload: effectiveDeload(guidance?.deload, e.deloadMondays, monday) && !lateBlockWorkout(monday, e, own, programWeek, allSessions),
    trained: weekSessions.length > 0,
    enrollmentId: e.id,
  };
}

/**
 * A finished block's late workout: the first workout past the block's last
 * week closes it and is kept in that last week (advanceProgram — never a
 * "Semana 5" of a 4-week block). Its calendar week then repeats a program
 * week already trained in an earlier one, and ends the block. That week isn't
 * the program week's own: it takes none of its deload (a single late workout
 * is one workout of a normal week). A last week picked up again later
 * ("Retomar da semana 13") does take it: that block isn't closed in the week
 * by its workouts unless they complete it.
 */
function lateBlockWorkout(
  monday: number,
  e: StreakEnrollment,
  own: StreakSession[],
  programWeek: number,
  allSessions: StreakSession[],
): boolean {
  if (programWeek <= 0 || own.length === 0 || e.endedAt == null || mondayOf(dayNumberOf(e.endedAt)) !== monday) return false;
  return allSessions.some(
    (s) => s.enrollmentId === e.id && s.programWeek === programWeek && dayNumberOf(s.finishedAt) < monday,
  );
}

/**
 * Complete weeks (oldest → newest, up to last week) and this week, for
 * weeklyStreak. `sessions` are finished workouts with a working set.
 */
export function streakWeeksFrom(p: {
  sessions: StreakSession[];
  enrollments: StreakEnrollment[];
  /** Profile.daysPerWeek: the target of a week without a program. */
  profileDaysPerWeek: number;
  now: Date;
}): { weeks: StreakWeekRow[]; thisWeek: StreakWeekRow } {
  const thisMonday = mondayOf(dayNumberOf(p.now));
  const byMonday = new Map<number, StreakSession[]>();
  for (const s of p.sessions) {
    const m = mondayOf(dayNumberOf(s.finishedAt));
    if (m > thisMonday) continue;
    byMonday.set(m, [...(byMonday.get(m) ?? []), s]);
  }
  const first = Math.min(thisMonday, ...byMonday.keys());
  const weeks: StreakWeekRow[] = [];
  for (let m = first; m < thisMonday; m += 7) {
    weeks.push(weekRow(m, byMonday.get(m) ?? [], p.enrollments, p.sessions, p.profileDaysPerWeek));
  }
  const thisWeek = weekRow(thisMonday, byMonday.get(thisMonday) ?? [], p.enrollments, p.sessions, p.profileDaysPerWeek, true);
  return { weeks, thisWeek };
}

export interface WeeklyStreakSummary extends StreakResult {
  thisWeek: StreakWeekRow;
  /** Last complete week, if any (the Monday review). */
  lastWeek: StreakWeekRow | null;
  /**
   * This week falling short wouldn't break the run: a forgiven week (one per
   * 8 weeks of streak) or a neutral entry week — "para esta semana contar",
   * never "para manter a sequência".
   */
  freeWeekAvailable: boolean;
  /** Workouts still needed for this week to count (0 once it does). */
  remaining: number;
}

/** The streak and where this week stands, from the week rows. */
export function summarizeStreak(rows: { weeks: StreakWeekRow[]; thisWeek: StreakWeekRow }): WeeklyStreakSummary {
  const result = weeklyStreak(rows.weeks, rows.thisWeek);
  const { thisWeek } = rows;
  const counts = weekCounts(thisWeek);
  const remaining = counts ? 0 : thisWeek.deload ? 1 : Math.max(0, thisWeek.target - thisWeek.done);
  // Would the run survive this week ending as a miss? (weeklyStreak's own forgiveness, or a neutral week.)
  const ifMissed = weeklyStreak([...rows.weeks, { met: false, neutral: thisWeek.neutral }]);
  return {
    ...result,
    thisWeek,
    lastWeek: rows.weeks[rows.weeks.length - 1] ?? null,
    freeWeekAvailable: !counts && ifMissed.current > 0,
    remaining,
  };
}
