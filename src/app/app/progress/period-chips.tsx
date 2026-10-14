import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import type { ProgressPeriod } from "@/lib/data/progress";

export const PERIODS: { value: ProgressPeriod; label: string; span: string }[] = [
  { value: "4w", label: "4 semanas", span: "nas últimas 4 semanas" },
  { value: "8w", label: "8 semanas", span: "nas últimas 8 semanas" },
  { value: "3m", label: "3 meses", span: "nos últimos 3 meses" },
  { value: "6m", label: "6 meses", span: "nos últimos 6 meses" },
  { value: "1y", label: "1 ano", span: "no último ano" },
  { value: "all", label: "Tudo", span: "desde o início" },
];

/**
 * The period filter (Progress, Corpo and an exercise's history): one row of
 * equal segments from sm, three to a row on a phone so none falls off the
 * screen; the current one on the soft green plate.
 */
export function PeriodChips({
  period,
  basePath,
  extraParams,
  className,
}: {
  period: ProgressPeriod;
  basePath: string;
  /** Other params the links keep. */
  extraParams?: Record<string, string>;
  className?: string;
}) {
  return (
    <nav aria-label="Período" className={cn("grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap", className)}>
      {PERIODS.map((p) => {
        const params = new URLSearchParams({ ...extraParams, period: p.value });
        const current = p.value === period;
        return (
          <Link
            key={p.value}
            href={`${basePath}?${params.toString()}`}
            aria-current={current ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border px-3.5 text-sm tabular-nums transition-colors",
              current
                ? "border-accent bg-accent-soft font-semibold text-accent"
                : "border-border bg-surface text-muted hover:border-border-strong hover:text-foreground",
            )}
          >
            {p.label}
          </Link>
        );
      })}
    </nav>
  );
}
