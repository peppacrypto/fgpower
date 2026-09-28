import { wallClock } from "@/lib/training/week";
import { formatNumber, formatKg, formatVolume, plural } from "@/lib/utils/format";

/*
 * The pure half of the progression charts (chart.tsx draws them on the
 * server): the value domain and its ticks, where each point sits, and the
 * words a chart is summed up in — its headline and its text alternative.
 */

/** What a chart's numbers are: loads and e1RM, kg × reps totals, reps, or a hold's seconds. */
export type ChartUnit = "kg" | "volume" | "reps" | "seconds";

export interface ChartInputPoint {
  /** Stable per point — the session id (two workouts on one day are two points). */
  key: string;
  date: Date;
  /** null: nothing to plot for this session (an e1RM from a 15-rep set) — skipped, never a 0. */
  value: number | null;
  /** The session broke a record this chart shows: a dot marks it. */
  record?: boolean;
  /** What the tap readout says after the date ("65 kg × 6"); the value alone when absent. */
  detail?: string;
}

export interface PlacedPoint {
  key: string;
  date: Date;
  value: number;
  /** 0–100, left → right (time-proportional). */
  x: number;
  /** 0–100, top → bottom. */
  y: number;
  record: boolean;
  last: boolean;
  detail?: string;
}

export interface ChartScale {
  lo: number;
  hi: number;
  /** Tick values, low → high (the domain edges included). */
  ticks: number[];
}

const EPS = 1e-9;
const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

/**
 * "07 SET" on the São Paulo calendar — the dossier's mono date — with the
 * year when it isn't this year's ("22 SET 2025"), so a year-long chart never
 * reads as three days.
 */
export function monoDate(date: Date, now: Date = new Date()): string {
  const w = wallClock(date);
  const text = `${String(w.day).padStart(2, "0")} ${MONTHS[w.month - 1]}`;
  return w.year === wallClock(now).year ? text : `${text} ${w.year}`;
}

/** "07/09" — short numeric date for spoken summaries. */
function numericDate(date: Date): string {
  const w = wallClock(date);
  return `${String(w.day).padStart(2, "0")}/${String(w.month).padStart(2, "0")}`;
}

/** 1, 2, 2.5 and 5 times a power of ten: the steps a scale reads at a glance. */
function isNice(n: number): boolean {
  const pow = Math.pow(10, Math.floor(Math.log10(n)));
  const m = n / pow;
  return [1, 2, 2.5, 5, 10].some((x) => Math.abs(m - x) < 1e-6);
}

/** The default tick grain of a unit (loads use the user's plate step instead). */
export function defaultStep(unit: ChartUnit): number {
  switch (unit) {
    case "kg":
      return 2.5;
    case "volume":
      return 10;
    case "reps":
      return 1;
    case "seconds":
      return 5;
  }
}

/**
 * A domain that follows the data (never pinned to 0: 60 → 65 kg must not draw
 * flat on a 0–80 scale): the values ±5%, widened out to multiples of a tick
 * step that is itself a multiple of `step` (the load increment) and a "nice"
 * number, with at most `maxIntervals` gaps between ticks.
 */
export function valueScale(values: number[], step: number, maxIntervals = 3): ChartScale {
  const finite = values.filter((v) => Number.isFinite(v));
  const base = step > 0 ? step : 1;
  if (finite.length === 0) return { lo: 0, hi: base, ticks: [0, base] };
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  let lo = Math.max(0, min * 0.95);
  let hi = max * 1.05;
  if (hi - lo < EPS) {
    // All zeros: a single step of room.
    lo = 0;
    hi = base;
  }
  const candidates: number[] = [base];
  for (let exp = -2; exp <= 7; exp++) {
    for (const m of [1, 2, 2.5, 5]) {
      const c = m * Math.pow(10, exp);
      const ratio = c / base;
      if (c > base + EPS && Math.abs(ratio - Math.round(ratio)) < 1e-6 && isNice(c)) candidates.push(c);
    }
  }
  candidates.sort((a, b) => a - b);
  for (const t of candidates) {
    const from = Math.floor(lo / t + EPS) * t;
    const to = Math.ceil(hi / t - EPS) * t;
    const gaps = Math.round((to - from) / t);
    if (gaps <= maxIntervals && gaps >= 1) {
      const ticks = Array.from({ length: gaps + 1 }, (_, i) => round(from + i * t));
      return { lo: ticks[0], hi: ticks[ticks.length - 1], ticks };
    }
  }
  return { lo: 0, hi: max, ticks: [0, max] };
}

function round(n: number) {
  return Math.round(n * 1e6) / 1e6;
}

/**
 * Where each point sits: x by time (a two-week gap looks like one), y inside
 * the scale. Points without a value are dropped. The last point is flagged.
 */
export function placePoints(points: ChartInputPoint[], scale: ChartScale): PlacedPoint[] {
  const valued = points
    .filter((p): p is ChartInputPoint & { value: number } => p.value != null && Number.isFinite(p.value))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  if (valued.length === 0) return [];
  const t0 = valued[0].date.getTime();
  const t1 = valued[valued.length - 1].date.getTime();
  const span = t1 - t0;
  const range = scale.hi - scale.lo || 1;
  return valued.map((p, i) => ({
    key: p.key,
    date: p.date,
    value: p.value,
    x: span > 0 ? ((p.date.getTime() - t0) / span) * 100 : 50,
    y: (1 - (p.value - scale.lo) / range) * 100,
    record: p.record === true,
    last: i === valued.length - 1,
    detail: p.detail,
  }));
}

/** A tick label: bare pt-BR numbers ("62,5", "1.225"); the headline carries the unit. */
export function formatTick(v: number, unit: ChartUnit): string {
  return formatNumber(v, unit === "kg" ? 2 : 0);
}

/** One value with its unit: "62,5 kg", "1.225 kg", "12 reps", "45 s". */
export function formatValue(v: number, unit: ChartUnit): string {
  switch (unit) {
    case "kg":
      return formatKg(v);
    case "volume":
      return formatVolume(v);
    case "reps":
      return plural(v, "rep", "reps");
    case "seconds":
      return `${formatNumber(v, 0)} s`;
  }
}

/** The bare number of a value, in the unit's precision ("62,5", "1.225"). */
function bare(v: number, unit: ChartUnit): string {
  return formatNumber(unit === "volume" ? Math.round(v) : v, unit === "kg" ? 2 : 0);
}

/** "+5 kg", "−2 reps", "+15 s" — the signed change, with a true minus sign. */
export function formatDelta(delta: number, unit: ChartUnit): string {
  const sign = delta > 0 ? "+" : "−";
  return `${sign}${formatValue(Math.abs(delta), unit)}`;
}

/** "+8%", "−3%" (whole percent); null when there is no base to compare with. */
export function formatPct(from: number, to: number): string | null {
  if (!(from > 0)) return null;
  const pct = Math.round(((to - from) / from) * 100);
  if (pct === 0) return "0%";
  return `${pct > 0 ? "+" : "−"}${Math.abs(pct)}%`;
}

export interface ChartSummary {
  /** "60 → 65 kg · +5 kg (+8%)" — the change over the chart. */
  headline: string;
  /** The headline's two halves ("60 → 65 kg", "+5 kg (+8%)"), to wrap between them on a narrow screen. */
  parts: [string] | [string, string];
  /** "desde 07 SET" / "em 07 SET". */
  since: string;
  /** The chart's text alternative. */
  ariaLabel: string;
}

/**
 * The chart in words: first → last with the change, and the spoken version
 * ("Melhor carga por sessão: de 60 para 65 kg entre 07/09 e 21/09, em 8
 * sessões; máxima 67,5 kg").
 */
export function summarize(label: string, placed: PlacedPoint[], unit: ChartUnit, now: Date = new Date()): ChartSummary {
  if (placed.length === 0) {
    const headline = "Sem dados no período";
    return { headline, parts: [headline], since: "", ariaLabel: `${label}: sem dados no período.` };
  }
  const first = placed[0];
  const last = placed[placed.length - 1];
  if (placed.length === 1) {
    return {
      headline: formatValue(last.value, unit),
      parts: [formatValue(last.value, unit)],
      since: `em ${monoDate(last.date, now)}`,
      ariaLabel: `${label}: ${formatValue(last.value, unit)} em ${numericDate(last.date)}, a primeira sessão registrada.`,
    };
  }
  const delta = last.value - first.value;
  const same = Math.abs(delta) < 1e-6;
  const pct = formatPct(first.value, last.value);
  const change = same ? "mesma marca" : `${formatDelta(delta, unit)}${pct ? ` (${pct})` : ""}`;
  const unitWord = formatValue(last.value, unit).slice(bare(last.value, unit).length);
  const range = `${bare(first.value, unit)} → ${bare(last.value, unit)}${unitWord}`;
  const headline = `${range} · ${change}`;
  const peak = Math.max(...placed.map((p) => p.value));
  const ariaLabel =
    `${label}: de ${formatValue(first.value, unit)} para ${formatValue(last.value, unit)} ` +
    `entre ${numericDate(first.date)} e ${numericDate(last.date)}, em ${placed.length} sessões` +
    (peak > last.value + 1e-6 ? `; máxima ${formatValue(peak, unit)}.` : ".");
  return { headline, parts: [range, change], since: `desde ${monoDate(first.date, now)}`, ariaLabel };
}

/**
 * Mini-sparkline geometry in a fixed box: an SVG points string and the last
 * point, values scaled to the series' own min–max (flat series sit mid-height).
 */
export function sparkPath(values: number[], width: number, height: number, pad = 3) {
  const vs = values.filter((v) => Number.isFinite(v));
  if (vs.length === 0) return null;
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const span = max - min;
  const n = vs.length;
  const pts = vs.map((v, i) => {
    const x = n === 1 ? width / 2 : pad + (i / (n - 1)) * (width - 2 * pad);
    const y = span < 1e-9 ? height / 2 : pad + (1 - (v - min) / span) * (height - 2 * pad);
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10] as const;
  });
  return { points: pts.map(([x, y]) => `${x},${y}`).join(" "), last: pts[pts.length - 1] };
}
