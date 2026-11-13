import { MONTHS_SHORT, WEEKDAYS_FULL } from "@/lib/utils/date-names";

/**
 * Dieta's days: São Paulo calendar days, numbered as BodyMetric's
 * (lib/training/day-rotation dayNumberOf), and written "YYYY-MM-DD" in links
 * (?dia=) and in what the client sends. Pure.
 */

const DAY_MS = 86_400_000;

/** How far back a day can be marked: a year and a day, as body metrics (lib/actions/body-metrics). */
export const DIET_BACKDATE_DAYS = 366;

/** "2026-11-13" → its day number; null unless it is a real date written that way. */
export function dayOfIso(iso: unknown): number | null {
  if (typeof iso !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const utc = Date.UTC(y, mo - 1, d);
  const check = new Date(utc);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return Math.floor(utc / DAY_MS);
}

/** A day number as "2026-11-13". */
export function isoOfDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/** Whether a day can be shown and marked: not ahead of today, not more than a year back. */
export function isMarkableDay(day: number, todayNo: number): boolean {
  return Number.isSafeInteger(day) && day <= todayNo && day >= todayNo - DIET_BACKDATE_DAYS;
}

/** ?dia= as a day that can be shown; today when missing, malformed, ahead or too old. */
export function parseDietDay(value: string | string[] | undefined, todayNo: number): number {
  const day = dayOfIso(value);
  return day != null && isMarkableDay(day, todayNo) ? day : todayNo;
}

/** "quinta, 13 nov" (with the year when it isn't this one: "terça, 11 nov 2025"). */
export function dietDateText(day: number, todayNo: number): string {
  const d = new Date(day * DAY_MS);
  const thisYear = new Date(todayNo * DAY_MS).getUTCFullYear();
  const text = `${WEEKDAYS_FULL[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
  return d.getUTCFullYear() === thisYear ? text : `${text} ${d.getUTCFullYear()}`;
}

/** "Hoje", "Ontem", or null (the date alone says it). */
export function dietDayName(day: number, todayNo: number): "Hoje" | "Ontem" | null {
  if (day === todayNo) return "Hoje";
  if (day === todayNo - 1) return "Ontem";
  return null;
}
