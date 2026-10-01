import { cn } from "@/lib/utils/cn";
import { dateOfDayNumber } from "@/lib/data/progress-core";
import { formatRate, weeklyRate, type AveragedPoint } from "@/lib/training/body-weight";
import { formatNumber } from "@/lib/utils/format";
import { ChartScrubber } from "./chart-scrubber";
import { formatTick, monoDate, valueScale } from "./scale";

/** "03/08" — a short numeric date for the spoken summary. */
function numericDate(day: number) {
  const d = new Date(day * 86_400_000);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const kg = (n: number) => `${formatNumber(n, 1)} kg`;

/**
 * Corpo's weight chart (W-083), drawn on the server like ProgressChart: each
 * day's weigh-in a small muted dot, the 7-day average the one accent line
 * (the trend — a day's weight swings 1–2 kg with water, salt and digestion),
 * and its latest value dotted. The headline says the average and how fast it
 * moves per week ("−0,4 kg/sem (−0,5%)" or "estável"), in neutral ink: down
 * is good for a cut and bad for a bulk. An image with a spoken summary; a
 * hairline readout follows a drag.
 */
export function BodyweightChart({
  points,
  className,
}: {
  /** The period's weigh-ins with their averages (body-weight movingAverage7), oldest first. */
  points: AveragedPoint[];
  className?: string;
}) {
  if (points.length === 0) return null;
  const withAvg = points.filter((p): p is AveragedPoint & { avg: number } => p.avg != null);
  const values = [...points.map((p) => p.value), ...withAvg.map((p) => p.avg)];
  const scale = valueScale(values, 0.5);
  const range = scale.hi - scale.lo || 1;
  const yOf = (v: number) => (1 - (v - scale.lo) / range) * 100;
  const first = points[0].day;
  const span = points[points.length - 1].day - first;
  const xOf = (day: number) => (span > 0 ? ((day - first) / span) * 100 : 50);
  const latestAvg = withAvg[withAvg.length - 1] ?? null;
  const firstAvg = withAvg[0] ?? null;
  const rate = weeklyRate(points);

  const ariaLabel =
    latestAvg && firstAvg && withAvg.length > 1
      ? `Peso, média de 7 dias: de ${kg(firstAvg.avg)} para ${kg(latestAvg.avg)} entre ${numericDate(firstAvg.day)} e ${numericDate(latestAvg.day)}, em ${points.length} pesagens.`
      : latestAvg
        ? `Peso, média de 7 dias: ${kg(latestAvg.avg)} em ${numericDate(latestAvg.day)}, em ${points.length} pesagens.`
        : `Peso: ${points.length === 1 ? "1 pesagem" : `${points.length} pesagens`}, de ${kg(points[0].value)} a ${kg(points[points.length - 1].value)}; a média de 7 dias ainda não tem pesagens suficientes.`;

  return (
    <figure className={cn("min-w-0 overflow-x-clip", className)} data-chart="Peso">
      <figcaption>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
          {latestAvg ? "Média 7 dias" : "Peso"}
        </p>
        <p className="mt-1 font-mono text-[13px] font-semibold tabular-nums text-foreground" data-bodyweight-headline>
          <span className="whitespace-nowrap">{latestAvg ? kg(latestAvg.avg) : kg(points[points.length - 1].value)}</span>
          {rate ? (
            <>
              {" "}
              <span className="whitespace-nowrap font-normal text-muted">· {formatRate(rate)}</span>
            </>
          ) : null}
        </p>
      </figcaption>

      <div className="mt-3 grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-2">
        <div aria-hidden className="relative h-32">
          {scale.ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 -translate-y-1/2 font-mono text-[10px] leading-none tabular-nums text-muted"
              style={{ top: `${yOf(t)}%` }}
            >
              {formatTick(t, "kg")}
            </span>
          ))}
        </div>
        <div role="img" aria-label={ariaLabel} className="relative h-32">
          {scale.ticks.map((t, i) => (
            <span
              key={t}
              aria-hidden
              className={cn("absolute inset-x-0 h-px", i === 0 ? "bg-border-strong" : "bg-border")}
              style={{ top: `${yOf(t)}%` }}
            />
          ))}
          <div className="absolute inset-y-0 left-1.5 right-1.5">
            {points.map((p) => (
              <span
                key={p.day}
                aria-hidden
                data-dot="weigh-in"
                className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/35"
                style={{ left: `${xOf(p.day)}%`, top: `${yOf(p.value)}%` }}
              />
            ))}
            {withAvg.length > 1 ? (
              <svg aria-hidden className="absolute inset-0 size-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                <polyline
                  points={withAvg.map((p) => `${round(xOf(p.day))},${round(yOf(p.avg))}`).join(" ")}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            ) : null}
            {latestAvg ? (
              <span
                aria-hidden
                data-dot="last"
                className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-2 ring-surface"
                style={{ left: `${xOf(latestAvg.day)}%`, top: `${yOf(latestAvg.avg)}%` }}
              />
            ) : null}
            <ChartScrubber
              points={points.map((p) => ({
                x: round(xOf(p.day)),
                y: round(yOf(p.avg ?? p.value)),
                date: monoDate(dateOfDayNumber(p.day)),
                text: p.avg != null ? `${kg(p.value)} · média ${kg(p.avg)}` : kg(p.value),
              }))}
            />
          </div>
        </div>
        <span aria-hidden />
        <div aria-hidden className="mt-2 flex items-center justify-between gap-2 font-mono text-[10px] tabular-nums text-muted">
          <span>{points.length > 1 ? monoDate(dateOfDayNumber(first)) : ""}</span>
          <span className="inline-flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-foreground/35" />
              pesagem
            </span>
            {withAvg.length > 1 ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0.5 w-3 bg-accent" />
                média
              </span>
            ) : null}
          </span>
          <span>{monoDate(dateOfDayNumber(points[points.length - 1].day))}</span>
        </div>
      </div>
      {withAvg.length === 0 ? (
        <p className="mt-2 text-xs text-muted">A média aparece a partir de 3 pesagens na mesma semana.</p>
      ) : null}
    </figure>
  );
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
