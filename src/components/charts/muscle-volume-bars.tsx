import { cn } from "@/lib/utils/cn";
import { formatNumber, pluralWord } from "@/lib/utils/format";
import { VOLUME_GUIDE, type VolumeRow } from "@/lib/programming/weekly-volume";

/** The bars' scale: 0–30 sets a week (the builder's strip). */
const SCALE = 30;
const pct = (n: number) => `${(Math.min(n, SCALE) / SCALE) * 100}%`;

function stateWord(row: Pick<VolumeRow, "status">) {
  return row.status === "none" ? "sem séries" : row.status === "low" ? "abaixo" : row.status === "high" ? "acima" : "na faixa";
}

/**
 * A row in words, its group's name: "Peitoral: 11 séries por semana, na
 * faixa", "Bíceps: 1 série por semana, abaixo" — or "Costas: nenhuma série"
 * (not "…, sem séries" after it: that says it twice).
 */
export function muscleRowLabel(row: Pick<VolumeRow, "label" | "sets" | "status">): string {
  if (row.sets <= 0) return `${row.label}: nenhuma série`;
  return `${row.label}: ${formatNumber(row.sets)} ${pluralWord(row.sets, "série", "séries")} por semana, ${stateWord(row)}`;
}

/**
 * "Séries por músculo" (W-085): the builder's volume strip look, read-only —
 * each group's weekly working sets on a 0–30 track with the 10–20 guide band.
 * Neutral ink outside the band, never a warning colour: programs leave some
 * muscles below it on purpose (W-131). Each row is labelled in words.
 */
export function MuscleVolumeBars({ rows, className }: { rows: VolumeRow[]; className?: string }) {
  return (
    <div className={cn("flex flex-col", className)} data-muscle-volume>
      {rows.map((row) => {
        const value = row.sets > 0 ? formatNumber(row.sets) : "—";
        const inBand = row.status === "ok";
        return (
          <div
            key={row.key}
            role="group"
            aria-label={muscleRowLabel(row)}
            className="flex min-h-9 items-center gap-2.5"
            data-muscle={row.key}
          >
            <span aria-hidden className="w-24 shrink-0 truncate text-sm">
              {row.label}
            </span>
            <span aria-hidden className="relative h-2.5 min-w-0 flex-1 bg-surface-2">
              <span
                className="absolute inset-y-0 bg-accent-soft"
                style={{ left: pct(VOLUME_GUIDE.min), width: `calc(${pct(VOLUME_GUIDE.max)} - ${pct(VOLUME_GUIDE.min)})` }}
              />
              <span
                className={cn("absolute inset-y-0.5 left-0", inBand ? "bg-accent" : "bg-foreground/35")}
                style={{ width: pct(row.sets) }}
              />
            </span>
            <span aria-hidden className="w-9 shrink-0 text-right font-mono text-sm font-bold tabular-nums">
              {value}
            </span>
            <span aria-hidden className="w-14 shrink-0 text-right font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
              {row.status === "none" ? "" : stateWord(row)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
