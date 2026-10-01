import { formatNumber } from "@/lib/utils/format";
import { GD_SERIES } from "./program-calendar";

/**
 * Body data (W-083): the weigh-ins and circumferences a user logs on
 * "Corpo" or in the post-workout check-in, and the numbers drawn from them —
 * the 7-day average and its weekly rate, and the GD weeks that ask for
 * measurements. Owner-only data: nothing here ever reaches a public or social
 * surface. Pure (the queries live in lib/data/body-metrics).
 */

export type BodyKind = "BODYWEIGHT" | "WAIST" | "CHEST" | "HIPS" | "ARM" | "THIGH" | "CALF";

export interface BodyKindConfig {
  kind: BodyKind;
  label: string;
  unit: "kg" | "cm";
  min: number;
  max: number;
  /** How to measure it the same way every time (the form's description). */
  hint: string | null;
}

/** What can be logged, in the forms' order. CUSTOM (in the schema) is not offered. */
export const BODY_KINDS: readonly BodyKindConfig[] = [
  { kind: "BODYWEIGHT", label: "Peso", unit: "kg", min: 25, max: 350, hint: null },
  { kind: "WAIST", label: "Cintura", unit: "cm", min: 40, max: 200, hint: "Na altura do umbigo, relaxado, no fim da expiração." },
  { kind: "CHEST", label: "Peitoral", unit: "cm", min: 50, max: 200, hint: "Na linha dos mamilos, braços relaxados." },
  { kind: "HIPS", label: "Quadril", unit: "cm", min: 50, max: 200, hint: "No ponto mais largo dos glúteos, pés juntos." },
  { kind: "ARM", label: "Braço", unit: "cm", min: 15, max: 70, hint: "Contraído, no ponto mais largo — sempre o mesmo lado." },
  { kind: "THIGH", label: "Coxa", unit: "cm", min: 25, max: 110, hint: "Logo abaixo do glúteo, em pé e relaxado — sempre o mesmo lado." },
  { kind: "CALF", label: "Panturrilha", unit: "cm", min: 20, max: 70, hint: "No ponto mais largo, em pé — sempre o mesmo lado." },
];

/** The circumferences (every kind but the weight). */
export const MEASUREMENT_KINDS = BODY_KINDS.filter((k) => k.kind !== "BODYWEIGHT");

export function bodyKind(kind: string): BodyKindConfig | null {
  return BODY_KINDS.find((k) => k.kind === kind) ?? null;
}

/** Rounded to 0.1 — a scale or a tape reads no finer. */
export function roundTenth(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * A logged value, checked against its kind's plausible range and rounded
 * to 0.1; the error names the range ("Confira o valor: entre 25 e 350 kg").
 */
export function checkBodyValue(
  kind: string,
  value: unknown,
): { ok: true; value: number; unit: "kg" | "cm" } | { ok: false; error: string } {
  const config = bodyKind(kind);
  if (!config) return { ok: false, error: "Medida desconhecida." };
  const n = typeof value === "number" && Number.isFinite(value) ? roundTenth(value) : NaN;
  if (!(n >= config.min && n <= config.max)) {
    return { ok: false, error: `Confira o valor: entre ${config.min} e ${config.max} ${config.unit}` };
  }
  return { ok: true, value: n, unit: config.unit };
}

/** "81,4 kg", "84 cm" — a body value with its unit (non-breaking space). */
export function formatBodyValue(value: number, unit: "kg" | "cm"): string {
  return `${formatNumber(value, 1)} ${unit}`;
}

// ---------------------------------------------------------------------------
// The 7-day average and its weekly rate
// ---------------------------------------------------------------------------

export interface DayValue {
  /** São Paulo day number (day-rotation dayNumberOf). */
  day: number;
  value: number;
}

export interface AveragedPoint extends DayValue {
  /** The trailing 7-day average ending this day; null with fewer than 3 weigh-ins in that window. */
  avg: number | null;
}

/** Weigh-ins a 7-day window needs before its average means anything. */
export const MIN_WEIGH_INS_FOR_AVERAGE = 3;

/**
 * Each weigh-in with the average of the weigh-ins in its trailing window
 * [day − 6, day] — the ones that exist (a missed morning isn't a zero).
 * Day-to-day swings of 1–2 kg (water, salt, digestion) wash out; the trend
 * shows. Rounded to 0.1. Points come back oldest first, one per day.
 */
export function movingAverage7(points: readonly DayValue[]): AveragedPoint[] {
  const byDay = new Map<number, number>();
  for (const p of points) if (Number.isFinite(p.value)) byDay.set(p.day, p.value);
  const sorted = [...byDay.entries()].map(([day, value]) => ({ day, value })).sort((a, b) => a.day - b.day);
  return sorted.map((p, i) => {
    const window: number[] = [];
    for (let j = i; j >= 0 && sorted[j].day >= p.day - 6; j--) window.push(sorted[j].value);
    const avg = window.length >= MIN_WEIGH_INS_FOR_AVERAGE ? roundTenth(window.reduce((a, b) => a + b, 0) / window.length) : null;
    return { ...p, avg };
  });
}

export interface WeeklyRate {
  kgPerWeek: number;
  /** Relative to the earlier average (−0.5 = −0.5% a week). */
  pctPerWeek: number;
}

/**
 * How fast the 7-day average moves: the latest average against the one
 * nearest to 14 days earlier (an average dated 11–17 days before), per week.
 * Null without both.
 */
export function weeklyRate(points: readonly AveragedPoint[]): WeeklyRate | null {
  const withAvg = points.filter((p): p is AveragedPoint & { avg: number } => p.avg != null);
  const latest = withAvg[withAvg.length - 1];
  if (!latest) return null;
  const target = latest.day - 14;
  let ref: (typeof withAvg)[number] | null = null;
  for (const p of withAvg) {
    if (p.day < latest.day - 17 || p.day > latest.day - 11) continue;
    if (!ref || Math.abs(p.day - target) < Math.abs(ref.day - target)) ref = p;
  }
  if (!ref || !(ref.avg > 0)) return null;
  const weeks = (latest.day - ref.day) / 7;
  const kgPerWeek = (latest.avg - ref.avg) / weeks;
  return { kgPerWeek, pctPerWeek: (kgPerWeek / ref.avg) * 100 };
}

/** Under this a week's change reads "estável". */
const STABLE_KG_PER_WEEK = 0.05;
const MINUS = "−";

/**
 * "−0,4 kg/sem (−0,5%)", "+0,2 kg/sem (+0,3%)" or "estável" — a true minus
 * sign and no good/bad colour anywhere it's shown: whether down is good
 * depends on the user's goal (cut or bulk). `percent: false` drops the
 * "(−0,5%)" (Progress's Corpo card: "−0,4 kg/sem").
 */
export function formatRate(rate: WeeklyRate, { percent = true }: { percent?: boolean } = {}): string {
  if (Math.abs(rate.kgPerWeek) < STABLE_KG_PER_WEEK) return "estável";
  const sign = rate.kgPerWeek > 0 ? "+" : MINUS;
  const kg = formatNumber(Math.abs(rate.kgPerWeek), 1);
  if (!percent) return `${sign}${kg} kg/sem`;
  const pct = formatNumber(Math.abs(rate.pctPerWeek), 1);
  return `${sign}${kg} kg/sem (${sign}${pct}%)`;
}

/** A signed change for a measurement row: "−1,5 cm", "+0,4 kg", "sem mudança". */
export function formatBodyDelta(delta: number, unit: "kg" | "cm"): string {
  if (Math.abs(delta) < 0.05) return "sem mudança";
  return `${delta > 0 ? "+" : MINUS}${formatNumber(Math.abs(delta), 1)} ${unit}`;
}

// ---------------------------------------------------------------------------
// The GD weeks that ask for it
// ---------------------------------------------------------------------------

/**
 * Whether the program week asks for body data: every GD block's first and
 * last weeks ask for the starting/final measurements ("média de 7 dias do
 * peso, cintura/membros") — "measure"; GD Adaptação's first week asks for a
 * daily weigh-in ("Pese-se toda manhã") — "weigh". Null otherwise.
 */
export function measurementWeek(p: {
  templateSlug: string | null | undefined;
  week: number;
  durationWeeks: number | null | undefined;
}): "measure" | "weigh" | null {
  if (!p.templateSlug || !(GD_SERIES as readonly string[]).includes(p.templateSlug)) return null;
  if (p.templateSlug === "gd-adaptacao") return p.week === 1 ? "weigh" : null;
  if (p.week === 1 || (p.durationWeeks != null && p.week === p.durationWeeks)) return "measure";
  return null;
}
