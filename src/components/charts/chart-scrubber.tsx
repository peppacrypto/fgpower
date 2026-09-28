"use client";

import * as React from "react";

export interface ScrubPoint {
  /** 0–100, left → right. */
  x: number;
  /** 0–100, top → bottom. */
  y: number;
  /** "21 SET" — the readout's first line. */
  date: string;
  /** "65 kg × 6" — its second line. */
  text: string;
}

/** How far the plot reaches past the scrubber on each side (progress-chart's left-1.5 / right-1.5). */
const PLOT_INSET = 6;
/** On touch, the readout stays up this long after the finger lifts. */
const TOUCH_LINGER_MS = 1600;

/**
 * The one client piece of a progression chart (the chart is drawn on the
 * server): drag or hover across the plot and a hairline snaps to the nearest
 * session, with its date and set in a square readout. It only enhances — the
 * session list under the charts has every value as text, and the chart's
 * aria-label sums it up — so it stays out of the accessibility tree.
 *
 * The readout is centred on the hairline and clamped inside the plot
 * (measured before paint), so it never widens the page or runs off its left
 * edge; it sits at the top of the plot, or at the bottom when the point is up
 * there, so it never hides the point. On touch it clears shortly after the
 * finger lifts.
 */
export function ChartScrubber({ points }: { points: ScrubPoint[] }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const readoutRef = React.useRef<HTMLSpanElement>(null);
  const linger = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [active, setActive] = React.useState<number | null>(null);

  const cancelLinger = React.useCallback(() => {
    if (linger.current) clearTimeout(linger.current);
    linger.current = null;
  }, []);
  React.useEffect(() => cancelLinger, [cancelLinger]);

  const pick = React.useCallback(
    (clientX: number) => {
      const box = ref.current?.getBoundingClientRect();
      if (!box || box.width === 0 || points.length === 0) return;
      const x = ((clientX - box.left) / box.width) * 100;
      let best = 0;
      for (let i = 1; i < points.length; i++) {
        if (Math.abs(points[i].x - x) < Math.abs(points[best].x - x)) best = i;
      }
      setActive(best);
    },
    [points],
  );

  const p = active != null ? points[active] : null;

  // Centred on the hairline, never outside the plot.
  React.useLayoutEffect(() => {
    const box = ref.current;
    const el = readoutRef.current;
    if (!box || !el || !p) return;
    // Measured from the plot's left edge: at the previous point's place, near
    // the right, the readout would shrink to fit and read narrower than it is.
    el.style.left = `${-PLOT_INSET}px`;
    const width = box.clientWidth;
    const w = el.offsetWidth;
    const x = (p.x / 100) * width;
    const left = Math.max(-PLOT_INSET, Math.min(x - w / 2, width + PLOT_INSET - w));
    el.style.left = `${Math.round(left)}px`;
    el.style.visibility = "visible";
  }, [p]);

  const release = (pointerType: string) => {
    if (pointerType === "mouse") return;
    cancelLinger();
    linger.current = setTimeout(() => setActive(null), TOUCH_LINGER_MS);
  };

  return (
    <div
      ref={ref}
      aria-hidden
      data-chart-scrubber
      // Vertical swipes still scroll the page; horizontal ones scrub.
      className="absolute inset-0 touch-pan-y select-none"
      onPointerDown={(e) => {
        cancelLinger();
        pick(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.pointerType === "mouse" || e.buttons > 0) pick(e.clientX);
      }}
      onPointerUp={(e) => release(e.pointerType)}
      onPointerCancel={(e) => release(e.pointerType)}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") setActive(null);
      }}
    >
      {p ? (
        <>
          <span className="pointer-events-none absolute inset-y-0 w-px bg-foreground/40" style={{ left: `${p.x}%` }} />
          <span
            data-chart-cursor
            className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground ring-2 ring-surface"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
          />
          <span
            ref={readoutRef}
            data-chart-readout
            // Placed (and shown) by the layout effect above, before paint.
            style={{ left: 0, visibility: "hidden" }}
            className={`pointer-events-none absolute z-10 flex max-w-[calc(100%+0.75rem)] flex-col border-l-2 border-l-accent bg-surface-2 px-2 py-1 font-mono tabular-nums shadow-[var(--shadow-sm)] ${
              // Away from the point: at the bottom when the point is in the top part of the plot.
              p.y < 45 ? "-bottom-1" : "-top-1"
            }`}
          >
            <span className="truncate text-[10px] uppercase tracking-wider text-muted">{p.date}</span>
            <span className="truncate text-[11px] font-semibold text-foreground">{p.text}</span>
          </span>
        </>
      ) : null}
    </div>
  );
}
