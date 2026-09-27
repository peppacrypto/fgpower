/**
 * pt-BR number and word formatting shared by every screen, so the same value
 * never shows as "62.5kg" on one page and "62,5 kg" on another.
 */

const NBSP = " ";

/** 62.5 → "62,5"; 40 → "40"; up to `maxFractionDigits` decimals, no trailing zeros. */
export function formatNumber(n: number | null | undefined, maxFractionDigits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: maxFractionDigits }).format(n);
}

/** A load: "62,5 kg" (non-breaking space, so it never wraps between number and unit). */
export function formatKg(n: number | null | undefined): string {
  return n === null || n === undefined || !Number.isFinite(n) ? "—" : `${formatNumber(n, 2)}${NBSP}kg`;
}

/** A session/weekly volume: whole kilos with thousands separators — "1.225 kg". */
export function formatVolume(n: number | null | undefined): string {
  return n === null || n === undefined || !Number.isFinite(n) ? "—" : `${formatNumber(Math.round(n), 0)}${NBSP}kg`;
}

/** A duration in seconds: "45 min", "1 h 15 min", "<1 min". */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return "—";
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return `<1${NBSP}min`;
  if (minutes < 60) return `${minutes}${NBSP}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}${NBSP}h` : `${h}${NBSP}h ${m}${NBSP}min`;
}

/** "RIR 2,5". */
export function formatRir(n: number | null | undefined): string {
  return n === null || n === undefined || !Number.isFinite(n) ? "" : `RIR ${formatNumber(n, 1)}`;
}

/** The word for a count: pluralWord(1, "série", "séries") → "série". */
export function pluralWord(n: number, singular: string, pluralForm: string): string {
  return Math.abs(n) === 1 ? singular : pluralForm;
}

/** A count with its word: plural(3, "série", "séries") → "3 séries"; plural(1, …) → "1 série". */
export function plural(n: number, singular: string, pluralForm: string): string {
  return `${formatNumber(n, 0)} ${pluralWord(n, singular, pluralForm)}`;
}
