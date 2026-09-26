/**
 * Calendar-week boundaries in the users' time zone. The server runs in UTC,
 * but a workout done Sunday 22:00 in São Paulo belongs to that week, not the
 * next one — so "this week" is computed on the São Paulo wall clock.
 */
export const APP_TIME_ZONE = "America/Sao_Paulo";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The wall-clock date/time parts of `date` in `timeZone` (month 1–12, weekday 0 = Sunday). */
export function wallClock(date: Date, timeZone: string = APP_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: WEEKDAYS.indexOf(get("weekday")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
  };
}

/** Milliseconds the zone's wall clock is ahead of UTC at `utcMs` (negative west of Greenwich). */
function zoneOffsetMs(utcMs: number, timeZone: string) {
  const w = wallClock(new Date(utcMs), timeZone);
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - Math.floor(utcMs / 1000) * 1000;
}

/** Monday 00:00 of the week containing `now`, on the given zone's wall clock. */
export function startOfWeek(now: Date = new Date(), timeZone: string = APP_TIME_ZONE): Date {
  const w = wallClock(now, timeZone);
  const daysSinceMonday = (w.weekday + 6) % 7;
  const midnightAsUtc = Date.UTC(w.year, w.month - 1, w.day - daysSinceMonday);
  return new Date(midnightAsUtc - zoneOffsetMs(midnightAsUtc, timeZone));
}

// ---------------------------------------------------------------------------
// Calendar-day helpers. Everything the app shows or buckets by date goes
// through these, so a workout finished 22:00 in São Paulo (01:00 UTC next day)
// lands on the day the user actually trained — never the server's UTC day.
// ---------------------------------------------------------------------------

/**
 * 00:00 of the given calendar date on the zone's wall clock, as an instant.
 * `month0` is 0–11 and overflows like `Date.UTC` (month 12 = January of the
 * next year, day 0 = last day of the previous month).
 */
export function zonedMidnight(year: number, month0: number, day: number, timeZone: string = APP_TIME_ZONE): Date {
  const midnightAsUtc = Date.UTC(year, month0, day);
  return new Date(midnightAsUtc - zoneOffsetMs(midnightAsUtc, timeZone));
}

/** The zone's calendar month containing `now` (`month0` 0–11). */
export function currentMonth(now: Date = new Date(), timeZone: string = APP_TIME_ZONE) {
  const w = wallClock(now, timeZone);
  return { year: w.year, month0: w.month - 1 };
}

/** [start, end) of a calendar month on the zone's wall clock — use `gte start, lt end`. */
export function monthBounds(year: number, month0: number, timeZone: string = APP_TIME_ZONE) {
  return { start: zonedMidnight(year, month0, 1, timeZone), end: zonedMidnight(year, month0 + 1, 1, timeZone) };
}

/** Number of days in a calendar month (time-zone independent). */
export function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/** Weekday (0 = Sunday) of the 1st of a calendar month (time-zone independent). */
export function firstWeekdayOfMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0, 1)).getUTCDay();
}

/** "YYYY-MM-DD" of `date` on the zone's wall clock — a stable key for grouping by day. */
export function dayKey(date: Date | string, timeZone: string = APP_TIME_ZONE): string {
  const w = wallClock(new Date(date), timeZone);
  return `${w.year}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`;
}

/**
 * pt-BR date text on the app's wall clock. Server components render in UTC
 * and client ones in the device zone; pinning the zone makes both print the
 * same day (and keeps SSR and hydration text identical).
 */
export function formatAppDate(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" },
  timeZone: string = APP_TIME_ZONE,
): string {
  return new Date(date).toLocaleDateString("pt-BR", { ...options, timeZone });
}
