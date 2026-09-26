/**
 * Search-param parsing for the history pages. Links get stale, shared and
 * hand-edited, so nothing here trusts its input: anything malformed or out of
 * range falls back to a sane default instead of reaching Prisma / `Date`.
 */

type Param = string | string[] | undefined;

/** Oldest calendar year the history navigator will open. */
export const MIN_HISTORY_YEAR = 2000;

function toInt(value: Param): number | null {
  if (typeof value !== "string" || !/^\s*-?\d+\s*$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : null;
}

/** ?page= as a positive integer (1 when missing or malformed). */
export function parsePageParam(value: Param): number {
  const n = toInt(value);
  return n != null && n >= 1 ? n : 1;
}

/**
 * ?year= & ?month= (0-indexed) for the calendar. Invalid parts fall back to
 * the current month's; a month in the future snaps back to the current one.
 */
export function parseMonthParams(
  sp: { year?: Param; month?: Param },
  current: { year: number; month0: number },
): { year: number; month0: number } {
  const y = toInt(sp.year);
  const m = toInt(sp.month);
  const year = y != null && y >= MIN_HISTORY_YEAR && y <= current.year ? y : current.year;
  const month0 = m != null && m >= 0 && m <= 11 ? m : current.month0;
  if (year === current.year && month0 > current.month0) return current;
  return { year, month0 };
}
