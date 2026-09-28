import { cn } from "@/lib/utils/cn";
import { sparkPath } from "./scale";

/**
 * A word-sized trend for list rows: one accent line over the series' own
 * range and a dot on the latest value. No axes — the row's text carries the
 * numbers; `label` says the trend in words for screen readers.
 */
export function Sparkline({
  values,
  label,
  width = 64,
  height = 22,
  className,
}: {
  /** Oldest first. */
  values: number[];
  label: string;
  width?: number;
  height?: number;
  className?: string;
}) {
  const path = sparkPath(values, width, height);
  if (!path) return null;
  return (
    <svg
      role="img"
      aria-label={label}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("shrink-0 overflow-visible", className)}
    >
      <line x1={0} x2={width} y1={height - 0.5} y2={height - 0.5} stroke="var(--border)" strokeWidth={1} />
      {values.length > 1 ? (
        <polyline
          points={path.points}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1.75}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : null}
      <circle cx={path.last[0]} cy={path.last[1]} r={2.75} fill="var(--accent)" stroke="var(--surface)" strokeWidth={1.5} />
    </svg>
  );
}
