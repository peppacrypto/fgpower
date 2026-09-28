/**
 * The user's pick for a week that follows one stopped mid-plan (W-089:
 * "Continuar a sequência" vs "Recomeçar"), kept in a cookie for that week
 * and that enrollment only — the next week asks again. Read by Today on the
 * server so the hero already shows the chosen day.
 */
export const WEEK_START_COOKIE = "fg-week-start";

export type WeekStartPick = "continue" | "restart";

/** The cookie's value: `<enrollmentId>.<weekKey>.<pick>`. */
export function weekStartValue(enrollmentId: string, weekKey: string, pick: WeekStartPick): string {
  return `${enrollmentId}.${weekKey}.${pick}`;
}

/** The pick stored for this enrollment and week, if any. */
export function readWeekStart(value: string | undefined, enrollmentId: string, weekKey: string): WeekStartPick | null {
  if (!value) return null;
  const [id, week, pick] = value.split(".");
  if (id !== enrollmentId || week !== weekKey) return null;
  return pick === "continue" || pick === "restart" ? pick : null;
}

/**
 * Monday's "Semana anterior" closed for a week (W-129): the week's key, kept
 * in localStorage and mirrored to this cookie so the server leaves it out
 * instead of drawing it and hiding it after hydration.
 */
export const WEEK_REVIEW_COOKIE = "fg-week-review";
export const WEEK_REVIEW_STORAGE_KEY = "fg:week-review-closed";
