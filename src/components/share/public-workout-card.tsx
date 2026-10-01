import { SectionHead } from "@/components/ui/section-head";
import { Badge } from "@/components/ui/badge";
import { isWorkoutMilestone } from "@/lib/programming/milestones";
import { exerciseLine, formatShareDate, statsLine, type PublicWorkoutView } from "@/lib/social/public-workout";
import { plural } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/** Mono micro-caps: the dossier's field labels. */
const FIELD = "font-mono text-[10px] font-bold uppercase tracking-[0.16em]";

/**
 * A finished workout as anyone outside the app sees it (/t/<token>): the
 * dossier's frame with the stats, the records once per exercise and each
 * exercise's sets — the loads only when the owner shows them. Server
 * component; renders only the sanitized view (lib/social/public-workout.ts).
 */
export function PublicWorkoutCard({
  view,
  finishedAt,
  durationSeconds,
  ordinal,
  fgCount,
  className,
}: {
  view: PublicWorkoutView;
  finishedAt: Date;
  durationSeconds: number | null;
  ordinal: number;
  fgCount: number;
  className?: string;
}) {
  return (
    <article className={cn("reg-frame p-5", className)} aria-labelledby="shared-workout-title">
      <div className="flex items-start justify-between gap-3">
        <p className={cn(FIELD, "text-[11px] tracking-[0.18em] text-accent")}>
          Treino concluído · <span className="whitespace-nowrap">{formatShareDate(finishedAt)}</span>
        </p>
        <span className={cn(FIELD, "shrink-0 text-[11px] text-muted")}>Nº {ordinal}</span>
      </div>
      <h1 id="shared-workout-title" className="text-display mt-2 text-3xl font-extrabold wrap-break-word">
        {view.workoutName}
      </h1>
      <p className="mt-2 font-mono text-xs tabular-nums text-muted">{statsLine(view, durationSeconds)}</p>
      {isWorkoutMilestone(ordinal) ? (
        <span
          className="mt-3 inline-block -rotate-2 border-2 border-accent px-2.5 py-1 font-mono text-sm font-extrabold uppercase tracking-[0.18em] text-accent"
          aria-label={`Dossiê número ${ordinal}`}
        >
          Dossiê nº {ordinal}
        </span>
      ) : null}

      {view.records.length > 0 ? (
        <section className="mt-6" aria-labelledby="shared-records">
          <SectionHead id="shared-records" label="Recordes" as="h2" count={plural(view.records.length, "exercício", "exercícios")} />
          <ul className="mt-3 flex flex-col gap-2">
            {view.records.map((r) => (
              <li key={r.exerciseName} className="flex items-center gap-3 border-l-4 border-l-accent-strong bg-accent-soft py-3 pl-4 pr-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold wrap-break-word">{r.exerciseName}</p>
                  <p className="mt-0.5 text-xs text-foreground/80">{r.text}</p>
                </div>
                <span className="tag tag--mark shrink-0">PR</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {view.exercises.length > 0 ? (
        <section className="mt-6" aria-labelledby="shared-exercises">
          <SectionHead id="shared-exercises" label="Exercícios" as="h2" count={view.exercises.length} />
          <ol className="mt-2 divide-y divide-border">
            {view.exercises.map((e, i) => (
              <li key={`${i}-${e.name}`} className="flex items-baseline gap-3 py-2.5">
                <span className="w-5 shrink-0 font-mono text-xs text-muted" aria-hidden>
                  {String(i + 1).padStart(2, "0")}
                </span>
                {/* The sets under the name on phones (a long name never breaks mid-word); beside it from sm. */}
                <div className="min-w-0 flex-1 sm:flex sm:items-baseline sm:gap-3">
                  <p className="text-sm font-semibold wrap-break-word sm:min-w-0 sm:flex-1">{e.name}</p>
                  <p className="mt-0.5 font-mono text-xs tabular-nums text-muted sm:mt-0 sm:shrink-0">{exerciseLine(e)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {!view.loadsShown || fgCount > 0 ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          {!view.loadsShown ? <p className={cn(FIELD, "text-muted")}>Cargas ocultas por quem treinou</p> : <span />}
          {fgCount > 0 ? <Badge variant="accent">{plural(fgCount, "FG", "FGs")}</Badge> : null}
        </div>
      ) : null}
    </article>
  );
}
