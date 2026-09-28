/**
 * A greyed stand-in for a chart that has no data yet: hairline rules and a
 * faint rising line in the empty state's ink — a preview of what training
 * twice will draw, never mistaken for real numbers (no values, no axis text).
 */
export function EmptyChartPreview({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 160 64" width={160} height={64} className={className} fill="none">
      {[8, 32, 56].map((y) => (
        <line key={y} x1={0} x2={160} y1={y} y2={y} stroke="currentColor" strokeOpacity={0.45} strokeWidth={1} />
      ))}
      <polyline
        points="6,50 34,46 60,40 86,41 112,30 138,24 154,16"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray="0.1 6"
      />
      <circle cx={154} cy={16} r={3.5} fill="currentColor" />
    </svg>
  );
}
