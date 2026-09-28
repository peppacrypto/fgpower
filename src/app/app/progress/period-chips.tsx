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

/** The period filter row (Progress and an exercise's history): square chips, the current one inked. */
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
    <nav aria-label="Período" className={cn("flex flex-wrap gap-1.5", className)}>
      {PERIODS.map((p) => {
        const params = new URLSearchParams({ ...extraParams, period: p.value });
        const current = p.value === period;
        return (
          <Link
            key={p.value}
            href={`${basePath}?${params.toString()}`}
            aria-current={current ? "page" : undefined}
            className={
              current
                ? "inline-flex min-h-11 items-center rounded-[2px] border border-accent bg-accent-soft px-3 text-xs font-semibold text-accent"
                : "inline-flex min-h-11 items-center rounded-[2px] px-3 text-xs text-muted hover:bg-surface-2"
            }
          >
            {p.label}
          </Link>
        );
      })}
    </nav>
  );
}
