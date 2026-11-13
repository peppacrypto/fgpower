/**
 * One amount against its target (Dieta's kcal and macros): the label and the
 * numbers in words above a thin bar — accent fill on a track of the same
 * green, lighter. Past the target the bar stays full and the numbers tell the
 * rest; no good/bad colour (whether more is a problem depends on the goal).
 * The bar is a progressbar named by the label, valued in words.
 */
export function Meter({
  label,
  value,
  max,
  valueText,
  className,
}: {
  label: string;
  value: number;
  max: number;
  /** The numbers as said and shown: "1.234 de 2.333 kcal". */
  valueText: string;
  className?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm tabular-nums text-muted">{valueText}</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={Math.max(0, max)}
        aria-valuenow={Math.max(0, Math.min(value, max))}
        aria-valuetext={valueText}
        // The track: the accent, thinned over the surface (reads in light and dark alike; --accent-soft fades out on dark).
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--accent)_16%,transparent)]"
      >
        <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
