import { isPostAdaptation, type SeriesBlock } from "@/lib/programming/gd-series";
import { cn } from "@/lib/utils/cn";

/** Heights of the rail's steps: the level ramp (Iniciante → Avançado). */
const LEVEL_STEP: Record<string, string> = { BEGINNER: "h-2", INTERMEDIATE: "h-3.5", ADVANCED: "h-5" };
/** GD 1 ("Pós-Adaptação"): a step above the Adaptação, below the intermediate blocks. */
const POST_ADAPTATION_STEP = "h-2.5";
const LEVELS = [
  ["BEGINNER", "Iniciante"],
  ["INTERMEDIATE", "Intermediário"],
  ["ADVANCED", "Avançado"],
] as const;

/** The rail: one segment per block, width by weeks, height by level; the years under it. */
export function SeriesRail({
  blocks,
  current,
  highlight = null,
  years,
  className,
}: {
  blocks: SeriesBlock[];
  /** The block to mark (the running one, or the dossier's own). */
  current: string | null;
  /** Blocks the library's filters kept; the others go faint. */
  highlight?: ReadonlySet<string> | null;
  years?: { year: number; weeks: number }[];
  className?: string;
}) {
  return (
    <div className={cn("mt-4", className)}>
      <div className="flex items-end gap-1" role="img" aria-label={railLabel(blocks, current)}>
        {blocks.map((b) => {
          const faint = highlight !== null && !highlight.has(b.slug);
          const isCurrent = b.slug === current;
          return (
            <div key={b.slug} className="flex min-w-[1.25rem] flex-col items-stretch" style={{ flex: `${b.durationWeeks} 1 0` }}>
              <span
                className={cn(
                  "mb-1.5 text-center text-xs leading-none tabular-nums",
                  isCurrent ? "font-semibold text-accent" : "font-medium text-muted",
                  faint && "opacity-40",
                )}
              >
                {b.short}
              </span>
              <span
                className={cn(
                  "block w-full rounded-[var(--radius-sm)]",
                  isPostAdaptation(b.slug, b.experienceLevel) ? POST_ADAPTATION_STEP : (LEVEL_STEP[b.experienceLevel] ?? "h-3"),
                  isCurrent ? "bg-accent" : "bg-border-strong",
                  faint && "opacity-30",
                )}
              />
            </div>
          );
        })}
      </div>
      {years && years.length > 1 ? (
        <div className="mt-2 flex gap-1 text-xs text-muted" aria-hidden>
          {years.map((y) => (
            <span key={y.year} className="border-t border-border pt-1.5" style={{ flex: `${y.weeks} 1 0` }}>
              Ano {y.year}
            </span>
          ))}
        </div>
      ) : null}
      <p className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1 text-xs text-muted" aria-hidden>
        {LEVELS.map(([level, label]) => (
          <span key={level} className="inline-flex items-end gap-1.5">
            <span className={cn("inline-block w-2 rounded-[var(--radius-sm)] bg-border-strong", LEVEL_STEP[level])} />
            {label}
          </span>
        ))}
      </p>
    </div>
  );
}

function railLabel(blocks: SeriesBlock[], current: string | null) {
  const names = blocks.map((b) => `${b.name} (${b.durationWeeks} semanas, ${b.levelLabel})`);
  const at = blocks.find((b) => b.slug === current);
  return `${blocks.length} blocos em sequência: ${names.join(", ")}.${at ? ` Destacado: ${at.name}.` : ""}`;
}
