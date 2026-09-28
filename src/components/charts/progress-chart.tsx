import { cn } from "@/lib/utils/cn";
import { ChartScrubber } from "./chart-scrubber";
import {
  defaultStep,
  formatTick,
  formatValue,
  monoDate,
  placePoints,
  summarize,
  valueScale,
  type ChartInputPoint,
  type ChartUnit,
} from "./scale";

/**
 * A progression chart drawn on the server as plain SVG + HTML (no chart
 * library, nothing blank while a bundle loads), in the dossier's terms: a
 * field label and a mono headline with the change ("60 → 65 kg · +5 kg (+8%)
 * desde 07 SET"), hairline rules at a few tick values of a domain that
 * follows the data, one accent line, and dots only where they mean something
 * — the latest session and the sessions that set a record. The plot is an
 * image with a spoken summary; a hairline readout follows a drag or a hover.
 *
 * The line lives in a stretched SVG (non-scaling stroke keeps it 2px at any
 * width); dots, rules and labels are HTML, so nothing is squashed or clipped.
 */
export function ProgressChart({
  label,
  unit,
  points,
  step,
  className,
}: {
  label: string;
  unit: ChartUnit;
  /** Oldest first or not — they are placed by date. */
  points: ChartInputPoint[];
  /** The tick grain: the user's load increment for kg charts. */
  step?: number;
  className?: string;
}) {
  const values = points.flatMap((p) => (p.value != null && Number.isFinite(p.value) ? [p.value] : []));
  const scale = valueScale(values, step && step > 0 ? step : defaultStep(unit));
  const placed = placePoints(points, scale);
  const summary = summarize(label, placed, unit);
  const range = scale.hi - scale.lo || 1;
  const yOf = (v: number) => (1 - (v - scale.lo) / range) * 100;
  const hasRecords = placed.some((p) => p.record && !p.last);

  return (
    // overflow-x: clip — nothing a chart draws may ever widen the page.
    <figure className={cn("min-w-0 overflow-x-clip", className)} data-chart={label}>
      <figcaption>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{label}</p>
        <p className="mt-1 font-mono text-[13px] font-semibold tabular-nums text-foreground">
          <span className="whitespace-nowrap">{summary.parts[0]}</span>
          {summary.parts[1] ? (
            <>
              {" "}
              <span className="whitespace-nowrap">· {summary.parts[1]}</span>
            </>
          ) : null}{" "}
          <span className="whitespace-nowrap font-normal text-muted">{summary.since}</span>
        </p>
      </figcaption>

      <div className="mt-3 grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-2">
        {/* Tick values, each centered on its rule. */}
        <div aria-hidden className="relative h-32">
          {scale.ticks.map((t) => (
            <span
              key={t}
              data-tick={t}
              className="absolute right-0 -translate-y-1/2 font-mono text-[10px] leading-none tabular-nums text-muted"
              style={{ top: `${yOf(t)}%` }}
            >
              {formatTick(t, unit)}
            </span>
          ))}
        </div>

        <div role="img" aria-label={summary.ariaLabel} className="relative h-32">
          {scale.ticks.map((t, i) => (
            <span
              key={t}
              aria-hidden
              className={cn("absolute inset-x-0 h-px", i === 0 ? "bg-border-strong" : "bg-border")}
              style={{ top: `${yOf(t)}%` }}
            />
          ))}
          {/* Inset so the first and last dots are never cut at the edges. */}
          <div className="absolute inset-y-0 left-1.5 right-1.5">
            {placed.length > 1 ? (
              <svg
                aria-hidden
                className="absolute inset-0 size-full overflow-visible"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <polyline
                  points={placed.map((p) => `${round(p.x)},${round(p.y)}`).join(" ")}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            ) : null}
            {placed.map((p) =>
              p.last || p.record ? (
                <span
                  key={p.key}
                  aria-hidden
                  data-dot={p.last ? "last" : "record"}
                  className={cn(
                    "absolute -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface",
                    p.last ? "size-2.5 bg-accent" : "size-2 border-2 border-accent bg-surface",
                  )}
                  style={{ left: `${p.x}%`, top: `${p.y}%` }}
                />
              ) : null,
            )}
            {placed.length > 0 ? (
              <ChartScrubber
                points={placed.map((p) => ({
                  x: round(p.x),
                  y: round(p.y),
                  date: monoDate(p.date),
                  text: p.detail ?? formatValue(p.value, unit),
                }))}
              />
            ) : null}
          </div>
        </div>

        <span aria-hidden />
        <div aria-hidden className="mt-2 flex items-center justify-between gap-2 font-mono text-[10px] tabular-nums text-muted">
          <span>{placed.length > 1 ? monoDate(placed[0].date) : ""}</span>
          {hasRecords ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full border-2 border-accent bg-surface" />
              recorde
            </span>
          ) : null}
          <span>{placed.length > 0 ? monoDate(placed[placed.length - 1].date) : ""}</span>
        </div>
      </div>
    </figure>
  );
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
