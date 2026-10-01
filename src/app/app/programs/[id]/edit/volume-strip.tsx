"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatNumber } from "@/lib/utils/format";
import { VOLUME_GUIDE, volumeSummary, type VolumeRow, type WeeklyVolume } from "@/lib/programming/weekly-volume";
import { muscleRowLabel } from "@/components/charts/muscle-volume-bars";

/** The bar's scale: 0 to 30 weekly sets (anything past it fills the bar). */
const SCALE = 30;
const pct = (n: number) => `${(Math.min(n, SCALE) / SCALE) * 100}%`;

/**
 * "Volume semanal": weekly sets per muscle, live while the program is built
 * (the program page's warnings only showed after leaving the editor). Folded
 * to one sticky line ("Volume semanal · 3 abaixo"); open, a mono bar per
 * muscle against the 10–20 guide band. A muscle below the band (or with no
 * sets) is a button: it opens the picker filtered to that muscle. Only the
 * folded line sticks: open, the panel stays in the page's flow (sticky, it
 * covered most of a phone screen over the rows being edited), brought into
 * view when opened from far down the page.
 */
export function VolumeStrip({
  volume,
  notes,
  dayFull = null,
  onAddFor,
}: {
  volume: WeeklyVolume;
  /** The program rules' other remarks (similar movements, no horizontal pull…). */
  notes: string[];
  /** The open day's name when it has no room left: the muscle rows can't add to it. */
  dayFull?: string | null;
  onAddFor: (muscleKey: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const summary = volumeSummary(volume.rows);
  const flagged = volume.rows.some((r) => r.status === "low" || r.status === "high");

  // Opened from the stuck line far down the page: un-stuck, the panel sits back
  // where the strip belongs, above the screen — scroll there instead of leaving it out of sight.
  useEffect(() => {
    if (open) ref.current?.scrollIntoView({ block: "nearest" });
  }, [open]);

  return (
    <section
      ref={ref}
      aria-label="Volume semanal"
      className={cn(
        "z-20 -mx-4 mt-4 scroll-mt-[env(safe-area-inset-top,0px)] border-y border-border bg-background px-4 sm:-mx-6 sm:px-6",
        !open && "sticky top-[env(safe-area-inset-top,0px)]",
      )}
      data-testid="volume-strip"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls="volume-panel"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full items-center gap-3 text-left"
      >
        <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Volume semanal</span>
        <MiniBars rows={volume.rows} />
        <span
          className={cn(
            "ml-auto truncate font-mono text-[10px] font-bold uppercase tracking-[0.1em]",
            flagged ? "text-warning" : "text-muted",
          )}
        >
          {summary}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open ? (
        <div id="volume-panel" className="max-h-[55dvh] overflow-y-auto overscroll-contain pb-3">
          <p className="text-xs text-muted">
            Séries por semana (as de apoio contam metade), contra a faixa de {VOLUME_GUIDE.min}–{VOLUME_GUIDE.max} para
            hipertrofia. É uma orientação, não uma regra.
            {volume.unknown > 0 ? " Calculando alguns exercícios…" : null}
          </p>
          {dayFull ? (
            <p className="mt-2 border-l-2 border-l-warning pl-2 text-xs text-foreground/85">
              “{dayFull}” está cheio. Abra outro dia para adicionar exercícios.
            </p>
          ) : null}
          <ul className="mt-2 flex flex-col">
            {volume.rows.map((row) => (
              <li key={row.key}>
                <MuscleRow row={row} onAdd={dayFull ? null : () => onAddFor(row.key)} />
              </li>
            ))}
          </ul>
          {notes.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-1 border-t border-border pt-2 text-xs text-foreground/85">
              {notes.map((n) => (
                <li key={n} className="border-l-2 border-l-border-strong pl-2">
                  {n}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/** Ten tiny bars in the folded line: a glance at the whole week. */
function MiniBars({ rows }: { rows: VolumeRow[] }) {
  return (
    <span aria-hidden className="flex h-4 shrink-0 items-end gap-[2px] max-[379px]:hidden">
      {rows.map((r) => (
        <span
          key={r.key}
          className={cn("w-[3px]", r.status === "ok" ? "bg-accent" : r.status === "none" ? "bg-border" : "bg-warning")}
          style={{ height: `${Math.max(2, (Math.min(r.sets, SCALE) / SCALE) * 16)}px` }}
        />
      ))}
    </span>
  );
}

/**
 * A muscle's bar; below the band it is a button that adds exercises for it (unless the day is full: `onAdd` null).
 * Named in Progress's words ("Séries por músculo"): "Bíceps: 1 série por semana, abaixo", "Costas: nenhuma série".
 */
function MuscleRow({ row, onAdd }: { row: VolumeRow; onAdd: (() => void) | null }) {
  const below = row.status === "low" || row.status === "none";
  const low = below && onAdd !== null;
  const value = row.status === "none" ? "0" : formatNumber(row.sets);
  const state = row.status === "low" ? "abaixo" : row.status === "high" ? "acima" : "na faixa";
  const spoken = muscleRowLabel(row);
  const body = (
    <>
      <span className="w-24 shrink-0 truncate text-left text-sm">{row.label}</span>
      <span className="relative h-2.5 min-w-0 flex-1 bg-surface-2" aria-hidden>
        {/* the 10–20 guide band */}
        <span
          className="absolute inset-y-0 bg-accent-soft"
          style={{ left: pct(VOLUME_GUIDE.min), width: `calc(${pct(VOLUME_GUIDE.max)} - ${pct(VOLUME_GUIDE.min)})` }}
        />
        <span
          className={cn("absolute inset-y-0.5 left-0", row.status === "ok" ? "bg-accent" : "bg-warning")}
          style={{ width: pct(row.sets) }}
        />
      </span>
      <span className="w-9 shrink-0 text-right font-mono text-sm font-bold tabular-nums">{value}</span>
      <span className="flex w-16 shrink-0 items-center justify-end gap-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
        {low ? (
          <>
            <Plus className="size-3 text-accent" aria-hidden />
            <span className="text-accent">Adic.</span>
          </>
        ) : (
          <span className={row.status === "high" || below ? "text-warning" : undefined}>{below ? "abaixo" : state}</span>
        )}
      </span>
    </>
  );
  return low ? (
    <button
      type="button"
      onClick={onAdd ?? undefined}
      aria-label={`${spoken}. Adicionar exercícios de ${row.label.toLowerCase()}`}
      className="flex min-h-11 w-full items-center gap-2.5 hover:bg-[var(--ink-2)]"
    >
      {body}
    </button>
  ) : (
    <div className="flex min-h-9 items-center gap-2.5" aria-label={spoken} role="group">
      {body}
    </div>
  );
}
