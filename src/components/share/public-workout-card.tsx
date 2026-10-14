import { SectionHead } from "@/components/ui/section-head";
import { Badge } from "@/components/ui/badge";
import { isWorkoutMilestone } from "@/lib/programming/milestones";
import { exerciseLine, formatShareDate, statsLine, type PublicWorkoutView } from "@/lib/social/public-workout";
import { plural } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/**
 * A finished workout as anyone outside the app sees it (/t/<token>): the
 * card with the stats, the records once per exercise and each
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
    <article className={cn("panel p-5 sm:p-7", className)} aria-labelledby="shared-workout-title">
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow text-accent">
          Treino concluído · <span className="whitespace-nowrap">{formatShareDate(finishedAt)}</span>
        </p>
        <span className="eyebrow shrink-0 tabular-nums">Nº {ordinal}</span>
      </div>
      <h1 id="shared-workout-title" className="text-display mt-1 text-[1.75rem] font-semibold leading-tight wrap-break-word sm:text-[2rem]">
        {view.workoutName}
      </h1>
      <p className="mt-2 text-[15px] tabular-nums text-muted">{statsLine(view, durationSeconds)}</p>
      {isWorkoutMilestone(ordinal) ? (
        <span
          className="mt-3 inline-flex items-center rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent"
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
              <li key={r.exerciseName} className="flex items-center gap-3 rounded-[var(--radius-md)] bg-accent-soft px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold wrap-break-word">{r.exerciseName}</p>
                  <p className="mt-0.5 text-[13px] tabular-nums text-foreground/80">{r.text}</p>
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
              <li key={`${i}-${e.name}`} className="py-3">
                {/* The sets under the name on phones (a long name never breaks mid-word); beside it from sm. */}
                <div className="min-w-0 sm:flex sm:items-baseline sm:gap-3">
                  <p className="text-[15px] font-medium wrap-break-word sm:min-w-0 sm:flex-1">{e.name}</p>
                  <p className="mt-0.5 text-[13px] tabular-nums text-muted sm:mt-0 sm:shrink-0">{exerciseLine(e)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {!view.loadsShown || fgCount > 0 ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          {!view.loadsShown ? <p className="text-[13px] text-muted">Cargas ocultas por quem treinou</p> : <span />}
          {fgCount > 0 ? <Badge variant="accent">{plural(fgCount, "FG", "FGs")}</Badge> : null}
        </div>
      ) : null}
    </article>
  );
}
