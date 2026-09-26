/**
 * A workout left open: started on an earlier day (São Paulo wall clock) or
 * so long ago that it can no longer be a session still being trained. Such a
 * session should not show a 97-hour clock, lock Today, or be saved as done
 * "now" — it gets saved as done on its own day instead.
 *
 * The workout screen, Today and the finish actions all read an open session
 * through the rules below, so they agree on whether it was left open, on the
 * day "Salvar como feito em …" dates it and on how long it took.
 */
import { wallClock } from "./week";

/** Nobody trains for 8 hours straight: past this, an open session was left open. */
export const STALE_AFTER_MS = 8 * 60 * 60 * 1000;
/** A session with a set written this recently is still being trained, even past midnight. */
export const LIVE_ACTIVITY_MS = 2 * 60 * 60 * 1000;
/** More than this between two sets splits them into separate bouts of training. */
export const BOUT_GAP_MS = 2 * 60 * 60 * 1000;
/** A bout of training is timed at most this long (and at least a minute). */
export const MAX_BOUT_SECONDS = 4 * 60 * 60;
/** Without set times, a workout saved on its own day is dated (and timed) this long after its start. */
const NO_SET_TIMES_MS = 60 * 60 * 1000;

/** The São Paulo calendar day of `date` as "YYYY-MM-DD" (sortable and comparable as a string). */
export function spDayKey(date: Date): string {
  const w = wallClock(date);
  return `${w.year}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`;
}

/** True when the session started on an earlier São Paulo calendar day or more than 8 h ago. */
export function isStaleSession(startedAt: Date, now: Date = new Date()): boolean {
  if (now.getTime() - startedAt.getTime() > STALE_AFTER_MS) return true;
  return spDayKey(startedAt) < spDayKey(now);
}

export interface Bout {
  start: Date;
  end: Date;
}

/** Set times grouped into bouts of training — split where more than 2 h passed between two sets — in time order. */
export function setBouts(times: Date[]): Bout[] {
  const sorted = times
    .map((t) => t.getTime())
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const bouts: { start: number; end: number }[] = [];
  for (const t of sorted) {
    const last = bouts[bouts.length - 1];
    if (last && t - last.end <= BOUT_GAP_MS) last.end = t;
    else bouts.push({ start: t, end: t });
  }
  return bouts.map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
}

/** How long a bout took: first to last set, at least a minute, at most 4 h. */
export function boutSeconds(bout: Bout): number {
  const seconds = Math.round((bout.end.getTime() - bout.start.getTime()) / 1000);
  return Math.min(MAX_BOUT_SECONDS, Math.max(60, seconds));
}

/**
 * How "Salvar como feito em …" (finishStaleWorkoutSession) dates and times a
 * workout left open: at the end of its first bout of sets, timed by that
 * bout. Sets done later — after "Continuar hoje" — still count in its totals
 * but never stretch its date or its duration across days. Without set times:
 * its start + 1 h, timed 1 h. Never later than `now`.
 */
export function staleSaveTiming(
  startedAt: Date,
  setTimes: Date[],
  now: Date = new Date(),
): { finishedAt: Date; durationSeconds: number } {
  const startMs = startedAt.getTime();
  const first = setBouts(setTimes)[0];
  if (!first) {
    const at = Math.max(startMs, Math.min(now.getTime(), startMs + NO_SET_TIMES_MS));
    return { finishedAt: new Date(at), durationSeconds: Math.max(60, Math.round((at - startMs) / 1000)) };
  }
  const at = Math.min(now.getTime(), Math.max(startMs, first.end.getTime()));
  return { finishedAt: new Date(at), durationSeconds: boutSeconds(first) };
}

/** A set row of an open session, as the rules below read it. */
export interface OpenSetRow {
  isCompleted: boolean;
  completedAt: Date | null;
  /** Bumped by every write to the row (typed, ✓, cleared). */
  updatedAt: Date;
  weightKg: number | null;
  reps: number | null;
  /** Its exercise was skipped: only rows already ✓'d count. */
  wasSkipped: boolean;
}

/**
 * When each set that finishing will count was done — rows ✓'d, or typed with
 * load and reps outside a skipped exercise — by its ✓ time, else by when it
 * was last typed (finishing dates an unconfirmed row the same way).
 */
export function countedSetTimes(rows: OpenSetRow[]): Date[] {
  const times: Date[] = [];
  for (const r of rows) {
    const counts = r.isCompleted || (!r.wasSkipped && r.weightKg !== null && r.reps !== null && r.reps >= 1);
    if (counts) times.push(r.isCompleted && r.completedAt ? r.completedAt : r.updatedAt);
  }
  return times;
}

export interface OpenSessionState {
  /**
   * Left open: stale and nothing written to it in the last 2 h. Today shows
   * it as "Treino de … não finalizado", and saving it on its own day is the
   * suggested way to close it. A workout started at 23:30 and still being
   * logged at 00:05 is live, not left open.
   */
  leftOpen: boolean;
  /**
   * The clock since "Iniciar" would mislead (days, or hours of nothing): show
   * since when it is open instead. Also true for a workout left open and
   * then continued today — only a live session under 8 h keeps its clock.
   */
  showSince: boolean;
  /** The latest write to any row with data, or null. */
  lastActivity: Date | null;
  /** How "Salvar como feito em …" would date and time it (staleSaveTiming). */
  saveAs: { finishedAt: Date; durationSeconds: number };
}

/** Reads an in-progress session's rows the way the workout screen and Today both need them. */
export function assessOpenSession(startedAt: Date, rows: OpenSetRow[], now: Date = new Date()): OpenSessionState {
  const stale = isStaleSession(startedAt, now);
  let last = 0;
  for (const r of rows) {
    const touched = r.isCompleted || r.weightKg !== null || r.reps !== null;
    if (touched && r.updatedAt.getTime() > last) last = r.updatedAt.getTime();
  }
  const lastActivity = last > 0 ? new Date(last) : null;
  const live = lastActivity !== null && now.getTime() - last <= LIVE_ACTIVITY_MS;
  return {
    leftOpen: stale && !live,
    showSince: stale && !(live && now.getTime() - startedAt.getTime() <= STALE_AFTER_MS),
    lastActivity,
    saveAs: staleSaveTiming(startedAt, countedSetTimes(rows), now),
  };
}

const WEEKDAYS_PT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** "20/09" on the São Paulo wall clock. */
export function formatSpDate(date: Date): string {
  const w = wallClock(date);
  return `${String(w.day).padStart(2, "0")}/${String(w.month).padStart(2, "0")}`;
}

/** "sáb, 20/09" on the São Paulo wall clock. */
export function formatSpWeekdayDate(date: Date): string {
  return `${WEEKDAYS_PT[wallClock(date).weekday]}, ${formatSpDate(date)}`;
}

/** "07:05" on the São Paulo wall clock. */
export function formatSpTime(date: Date): string {
  const w = wallClock(date);
  return `${String(w.hour).padStart(2, "0")}:${String(w.minute).padStart(2, "0")}`;
}
