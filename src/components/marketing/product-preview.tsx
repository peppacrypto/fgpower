import { Play, Trophy } from "lucide-react";
import { ProgressBar } from "@/components/ui/misc";

export interface PreviewExercise {
  namePt: string;
  sets: number;
  repMin: number;
  repMax: number;
}

/** A faithful, data-driven recreation of the Today screen — not a screenshot, but built from real seeded content (see the landing page's data fetch), never placeholder copy. */
export function ProductPreview({
  dayName,
  exercises,
  firstName = "Guilherme",
}: {
  dayName: string;
  exercises: PreviewExercise[];
  firstName?: string;
}) {
  return (
    <div className="flex flex-col gap-5 p-6 sm:p-8">
      <div>
        <p className="text-xs font-medium text-muted">Boa tarde, {firstName}</p>
        <h3 className="text-display mt-0.5 text-xl font-semibold">Hoje</h3>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-accent/30 bg-accent-soft p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">Programa ativo</p>
        <p className="mt-1 text-lg font-semibold">{dayName}</p>
        <p className="mt-0.5 text-sm text-muted">{exercises.length} exercícios · ~65 min</p>
        <button className="mt-3 inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-sm">
          <Play className="size-4" />
          Iniciar treino
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {exercises.slice(0, 4).map((ex) => (
          <div
            key={ex.namePt}
            className="flex items-center justify-between rounded-[var(--radius-md)] border border-border bg-surface px-3.5 py-2.5"
          >
            <span className="text-sm font-medium">{ex.namePt}</span>
            <span className="font-mono text-sm tabular-nums text-muted">
              {ex.sets}×{ex.repMin === ex.repMax ? ex.repMin : `${ex.repMin}-${ex.repMax}`}
            </span>
          </div>
        ))}
      </div>

      <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Progresso semanal</span>
          <span className="text-muted">2 / 3 treinos</span>
        </div>
        <ProgressBar value={66} className="mt-3" />
      </div>

      <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface px-3.5 py-3">
        <Trophy className="size-5 text-accent" />
        <div>
          <p className="text-sm font-semibold">Supino Reto com Barra</p>
          <p className="text-xs text-muted">Novo recorde de carga: 82,5kg</p>
        </div>
      </div>
    </div>
  );
}
