import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * FGPOWER glyph family — a single keyline primitive with SQUARE caps and
 * MITER joins (the deliberate anti-"friendly-rounded-lucide" move) plus solid
 * marks. Every semantic concept also has a 2-letter mono Lettermark, so meaning
 * is carried by form + letters, never by a clichéd pictogram or by color alone.
 */
type GlyphProps = React.SVGProps<SVGSVGElement> & { title?: string };

function Base({ className, title, children, ...props }: GlyphProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={cn("size-4 shrink-0", className)}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/** House arrow — square caps, miter join. Replaces lucide ArrowUpRight/ArrowRight. */
export function GArrow(p: GlyphProps) {
  return (
    <Base {...p}>
      <line x1="5" y1="19" x2="19" y2="5" />
      <polyline points="9,5 19,5 19,15" />
    </Base>
  );
}

/** Load axis — a bar loaded with square plates. Replaces the gym Dumbbell (training). */
export function GLoad(p: GlyphProps) {
  return (
    <Base {...p}>
      <line x1="4" y1="12" x2="20" y2="12" />
      <rect x="3" y="8" width="3" height="8" fill="currentColor" stroke="none" />
      <rect x="18" y="8" width="3" height="8" fill="currentColor" stroke="none" />
    </Base>
  );
}

/** Plumb line + calibration node — precision/alignment. Replaces the Microscope (execution/science). */
export function GExecution(p: GlyphProps) {
  return (
    <Base {...p}>
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <rect x="10" y="10" width="4" height="4" />
    </Base>
  );
}

/** Gain arrow at 45°. Replaces the LineChart (progress); pairs with the Δ lettermark. */
export function GProgress(p: GlyphProps) {
  return (
    <Base {...p}>
      <line x1="5" y1="19" x2="19" y2="5" />
      <polyline points="9,5 19,5 19,15" />
    </Base>
  );
}

/** Cohort — columns of differing height on a shared groundline. Replaces Users (community). */
export function GCohort(p: GlyphProps) {
  return (
    <Base {...p}>
      <line x1="9" y1="7" x2="9" y2="18" />
      <line x1="15" y1="10" x2="15" y2="18" />
      <line x1="5" y1="18" x2="19" y2="18" />
    </Base>
  );
}

/** Ruled lines, last one short — a record/note. Replaces the 📝 emoji. */
export function GNotes(p: GlyphProps) {
  return (
    <Base {...p}>
      <line x1="6" y1="8" x2="18" y2="8" />
      <line x1="6" y1="12" x2="18" y2="12" />
      <line x1="6" y1="16" x2="13" y2="16" />
    </Base>
  );
}

/** Bare square-cap check — "logged / done". Replaces the ✓ emoji and lucide Check. */
export function GCheck(p: GlyphProps) {
  return (
    <Base {...p}>
      <path d="M5 12 L10 17 L19 6" />
    </Base>
  );
}

/** Home mark — a square hearth, not a rounded house. For the "Hoje" nav item. */
export function GToday(p: GlyphProps) {
  return (
    <Base {...p}>
      <polyline points="4,11 12,4 20,11" />
      <polyline points="6,11 6,20 18,20 18,11" />
    </Base>
  );
}

/** Stacked records — a protocol/program sheet. For the "Programas" nav item. */
export function GProgram(p: GlyphProps) {
  return (
    <Base {...p}>
      <rect x="5" y="4" width="14" height="16" />
      <line x1="8" y1="9" x2="16" y2="9" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="12" y2="17" />
    </Base>
  );
}

/** A person as a Swiss column — square shoulders, no round head. For the "Perfil" nav item. */
export function GProfile(p: GlyphProps) {
  return (
    <Base {...p}>
      <rect x="9" y="4" width="6" height="6" />
      <polyline points="5,20 5,15 19,15 19,20" />
    </Base>
  );
}

/**
 * Lettermark — the primary, unambiguous device: a 2-letter JetBrains-Mono
 * code (what athletes actually say — PR, TR, EX, CO). Renders in a solid
 * accent square by default, or bare when `plain`.
 */
export function Lettermark({
  code,
  className,
  plain,
}: {
  code: string;
  className?: string;
  plain?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center font-mono font-bold tracking-[0.08em] leading-none",
        plain
          ? "text-foreground"
          : "size-[1.6em] bg-accent-soft text-accent text-[0.72em]",
        className,
      )}
      aria-hidden
    >
      {code}
    </span>
  );
}
