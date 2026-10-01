import { cn } from "@/lib/utils/cn";
import { dateOfDayNumber, type WeekColumn } from "@/lib/data/progress-core";
import { monoDate } from "./scale";

const DAY_NAMES = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
/** The day grid's row labels (every other day, as a calendar margin). */
const ROW_LABELS: Record<number, string> = { 0: "SEG", 2: "QUA", 4: "SEX" };

/** "4 de 5" — a week's count. */
function countText(c: WeekColumn) {
  return `${c.done} de ${c.target}`;
}

/** How a week is described in the table and in words. */
function stateText(c: WeekColumn) {
  if (c.current) return "esta semana";
  if (c.neutral && !c.met) return "semana de entrada";
  if (c.met && c.deload && c.done < c.target) return "semana de deload";
  return c.met ? "na meta" : "abaixo";
}

/**
 * "Treinos por semana" (W-085), drawn on the server as plain HTML: one column
 * per week of the period, aligned in two layers — a bar of the workouts that
 * week counted against its target (a tick), and under it the week's seven
 * days, trained ones filled. The streak's own weeks (lib/data/progress
 * getWeekRows), so a bar says what Today and "semanas na meta" say. This
 * week is drawn in progress, never judged. Fits a 320px phone even with a
 * year and more of weeks. An image with a spoken summary, plus a table for
 * screen readers.
 */
export function WeeklyTrainingChart({
  columns,
  todayOffset,
  summary,
  className,
}: {
  columns: WeekColumn[];
  /** Today's Monday-first offset (0–6) in the last column. */
  todayOffset: number;
  /** The chart in words (the figure's aria-label). */
  summary: string;
  className?: string;
}) {
  const n = columns.length;
  if (n === 0) return null;
  const fine = n <= 14;
  const maxY = Math.max(1, ...columns.map((c) => c.done), ...columns.map((c) => c.target));
  const grid = { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, columnGap: fine ? "2px" : "1px" };

  return (
    <figure className={cn("min-w-0 overflow-x-clip", className)} data-weekly-chart data-columns={n}>
      <div role="img" aria-label={summary}>
        <div className="grid grid-cols-[2rem_minmax(0,1fr)]">
          {/* Bars: workouts done, the week's target as a tick. */}
          <div aria-hidden className="relative h-16 font-mono text-[10px] leading-none tabular-nums text-muted">
            <span className="absolute right-1.5 top-0">{maxY}</span>
            <span className="absolute bottom-0 right-1.5">0</span>
          </div>
          <div aria-hidden className="grid h-16 items-end border-b border-border-strong" style={grid}>
            {columns.map((c) => {
              const height = `${(Math.min(c.done, maxY) / maxY) * 100}%`;
              const throughDeload = c.met && c.deload && c.done < c.target;
              return (
                <div key={c.monday} className="relative h-full" data-week={c.monday}>
                  <div
                    className={cn(
                      "absolute inset-x-0 bottom-0",
                      c.current
                        ? "bg-accent-soft shadow-[inset_0_0_0_1px_var(--accent)]"
                        : c.neutral && !c.met
                          ? "bg-foreground/15"
                          : throughDeload
                            ? "bg-accent/60"
                            : c.met
                              ? "bg-accent"
                              : "bg-foreground/25",
                    )}
                    style={{ height: c.current && c.done === 0 ? "2px" : height }}
                  />
                  {!(c.neutral && !c.met) ? (
                    <div
                      className="absolute inset-x-0 h-0.5 bg-foreground/70"
                      style={{ bottom: `calc(${(Math.min(c.target, maxY) / maxY) * 100}% - 1px)` }}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Days: seven rows, Monday first. The labels ride on the cells' rows without
              setting their height: a year of weeks makes 3–5px rows, and 9px labels in the
              grid would stretch them — the square cells would then widen past their columns
              and run together. */}
          <div aria-hidden className="relative mt-1.5 font-mono text-[9px] leading-none text-muted">
            {Object.entries(ROW_LABELS).map(([d, label]) => (
              <span key={d} className="absolute right-1.5 -translate-y-1/2" style={{ top: `${((Number(d) + 0.5) / 7) * 100}%` }}>
                {label}
              </span>
            ))}
          </div>
          <div aria-hidden className="mt-1.5 grid" style={grid} data-day-grid>
            {columns.map((c) => (
              <div key={c.monday} className="grid grid-rows-7 gap-px">
                {Array.from({ length: 7 }, (_, d) => {
                  const trained = c.days.includes(d);
                  const future = c.current && d > todayOffset;
                  const today = c.current && d === todayOffset;
                  return (
                    <span
                      key={d}
                      className={cn(
                        // Square, at most 14px: a few wide weeks keep a small calendar, not a wall of tiles.
                        "mx-auto aspect-square w-full max-w-3.5 rounded-[1px]",
                        trained ? "bg-accent" : future ? (fine ? "border border-dashed border-border-strong" : "") : "bg-surface-2",
                        today && fine && "outline-1 -outline-offset-1 outline-foreground",
                      )}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          <span aria-hidden />
          <div aria-hidden className="mt-2 flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-wider text-muted">
            <span>{monoDate(dateOfDayNumber(columns[0].monday))}</span>
            <span>esta semana</span>
          </div>
        </div>
      </div>

      <p aria-hidden className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-muted">
        <span className="inline-flex items-center gap-1">
          <span className="size-2 bg-accent" />
          na meta
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 bg-foreground/25" />
          abaixo
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-0.5 w-2.5 bg-foreground/70" />
          meta
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 bg-accent-soft shadow-[inset_0_0_0_1px_var(--accent)]" />
          esta semana
        </span>
      </p>

      {/* In an sr-only box, not an sr-only table: a table grows to its content and would widen the page. */}
      <div className="sr-only">
        <table>
          <caption>Treinos por semana</caption>
          <thead>
            <tr>
              <th scope="col">Semana</th>
              <th scope="col">Treinos</th>
              <th scope="col">Meta</th>
              <th scope="col">Dias</th>
            </tr>
          </thead>
          <tbody>
            {columns.map((c) => (
              <tr key={c.monday}>
                <th scope="row">{monoDate(dateOfDayNumber(c.monday))}</th>
                <td>{countText(c)}</td>
                <td>{stateText(c)}</td>
                <td>{c.days.length > 0 ? c.days.map((d) => DAY_NAMES[d]).join(", ") : "nenhum"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
