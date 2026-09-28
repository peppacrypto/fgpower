import type { BlockProgress } from "@/lib/programming/block-progress";
import { formatNumber } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/**
 * Where a running block stands, as the dossier writes it: "SEM. 3/13" over a
 * hairline week meter, then "18 de 65 treinos · 92% aderência". A short entry
 * week (activated Thursday–Sunday) says so and counts from Monday. From
 * lib/programming/block-progress.ts (data: program-lifecycle getBlockProgress).
 */
export function BlockProgressMeter({ progress, className }: { progress: BlockProgress; className?: string }) {
  const { week, weeks, entryWeek, sessionsDone, plannedSessions } = progress;
  const workouts =
    plannedSessions !== null
      ? `${formatNumber(sessionsDone, 0)} de ${formatNumber(plannedSessions, 0)} treinos`
      : `${formatNumber(sessionsDone, 0)} ${sessionsDone === 1 ? "treino" : "treinos"}`;
  return (
    <div className={cn("min-w-0", className)}>
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em]">
        {entryWeek ? (
          <>
            Semana de entrada<span className="text-muted"> · conta a partir de segunda</span>
          </>
        ) : weeks ? (
          <>
            Sem. {week}/{weeks}
          </>
        ) : (
          <>Sem. {week}</>
        )}
      </p>
      {weeks ? (
        <div className="mt-1.5 flex gap-0.5" aria-hidden>
          {Array.from({ length: weeks }, (_, i) => (
            <span key={i} className={cn("h-1 flex-1", i < week ? "bg-accent" : "bg-surface-2")} />
          ))}
        </div>
      ) : null}
      {!entryWeek && (sessionsDone > 0 || plannedSessions !== null) ? (
        <p className="mt-1.5 font-mono text-[11px] tabular-nums text-muted">
          {workouts}
        </p>
      ) : null}
    </div>
  );
}
