import { APP_TIME_ZONE, wallClock } from "@/lib/training/week";

/**
 * "há 5 min", "ontem, 18:40", "12 set": when something happened, the way a
 * timeline says it, on the São Paulo wall clock (the server runs in UTC, and
 * 23:30 in São Paulo is already "tomorrow" there). Pure, so it runs on the
 * server and the text reaches the client ready — no Date.now() in a client
 * component, no hydration mismatch. Number and unit are held together by a
 * no-break space (the row never wraps "5 / min").
 */

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const NBSP = "\u00a0";
const MINUTE = 60_000;
const DAY_MS = 86_400_000;

/** Days since 1970-01-01 of the São Paulo calendar day of `date`. */
function spDayNo(date: Date): number {
  const w = wallClock(date);
  return Math.floor(Date.UTC(w.year, w.month - 1, w.day) / DAY_MS);
}

/**
 * - under a minute (or a clock a little ahead): "agora";
 * - under an hour: "há 5 min";
 * - earlier the same São Paulo day: "há 3 h";
 * - the day before: "ontem, 18:40";
 * - within a week: "há 4 dias";
 * - this year: "12 set"; before: "12 set 2025".
 */
export function formatRelativeTime(date: Date | string, now: Date = new Date()): string {
  const then = new Date(date);
  const ms = now.getTime() - then.getTime();
  if (ms < MINUTE) return "agora";
  if (ms < 60 * MINUTE) return `há ${Math.floor(ms / MINUTE)}${NBSP}min`;

  const days = spDayNo(now) - spDayNo(then);
  const w = wallClock(then);
  if (days <= 0) return `há ${Math.floor(ms / (60 * MINUTE))}${NBSP}h`;
  if (days === 1) return `ontem, ${String(w.hour).padStart(2, "0")}:${String(w.minute).padStart(2, "0")}`;
  if (days < 7) return `há ${days}${NBSP}dias`;
  const dayMonth = `${w.day}${NBSP}${MONTHS[w.month - 1]}`;
  return w.year === wallClock(now).year ? dayMonth : `${dayMonth} ${w.year}`;
}

/** The full moment, for a tooltip or a screen reader: "28 de setembro de 2026 às 18:40". */
export function formatFullDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: APP_TIME_ZONE }).format(
    new Date(date),
  );
}
