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
