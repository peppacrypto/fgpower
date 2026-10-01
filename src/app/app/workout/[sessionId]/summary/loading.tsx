import { Bone, SkeletonScreen } from "@/components/ui/skeleton";
import { SectionHead } from "@/components/ui/section-head";
import { NestedSkeleton } from "@/components/ui/skeleton-client";
import { EditSetsSkeleton } from "./editar/loading";

/**
 * The post-workout dossier (summary/page.tsx), drawn as it lays out: the
 * masthead panel (kicker with the date, "Treino nº · week", the day's title,
 * the stats line, the saved line), the check-in folded to its one line, the
 * share block between rules ("Quem vê", then "Fora do app"), one panel for
 * the records or the baseline, then the exercise cards. Keep in step with
 * the page.
 */
export function SummarySkeleton() {
  return (
    <SkeletonScreen label="o resumo do treino" className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      {/* The masthead panel (accent rule): TREINO CONCLUÍDO · date and "⋯", Treino nº · week,
          the day's title (two lines of 36px on a phone), the stats line, SALVO NO HISTÓRICO ✓. */}
      <div className="relative panel-raised">
        <span className="absolute left-0 top-0 h-full w-1.5 bg-accent" aria-hidden />
        <div className="py-5 pl-6 pr-3 sm:py-7 sm:pl-8 sm:pr-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-[22px] items-center">
              <Bone className="h-3 w-52" />
            </div>
            <span className="-mr-1 -mt-1.5 size-11 shrink-0" />
          </div>
          <div className="mt-2 flex h-4 items-center">
            <Bone className="h-3 w-40" />
          </div>
          <div className="mt-1.5 flex h-18 flex-col justify-around sm:h-10">
            <Bone className="h-7 w-3/4 sm:w-1/2" />
            <Bone className="h-7 w-1/2 sm:hidden" />
          </div>
          <div className="mt-2 flex h-5 items-center">
            <Bone className="h-3.5 w-3/4" />
          </div>
          <div className="mt-3 flex h-4 items-center">
            <Bone className="h-3 w-40" />
          </div>
        </div>
      </div>

      {/* The check-in (check-in-card.tsx) as one line: answered or skipped, it folds to 52px. */}
      <div className="reg-frame mt-5 flex h-[52px] items-center px-3">
        <Bone className="h-3 w-40" />
      </div>

      {/* Quem vê: label and the three-way switch (stacked in a column under
          21rem, as share-workout-form lays it out), then who that is; then
          "Fora do app" with its two buttons (side by side from 360px) and the
          helper line — between hairlines. */}
      <div className="@container mt-5 border-y border-border py-3">
        <div className="flex flex-col items-stretch gap-1.5 @min-[21rem]:flex-row @min-[21rem]:items-center @min-[21rem]:gap-3">
          <div className="flex h-4 items-center">
            <Bone className="h-2.5 w-16 shrink-0" />
          </div>
          <Bone className="h-10 @min-[21rem]:flex-1" />
        </div>
        <Bone className="mt-3.5 h-3 w-2/5" />
        <div className="mt-3.5 border-t border-border pt-3">
          <div className="flex h-4 items-center">
            <Bone className="h-2.5 w-20" />
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
            <Bone className="h-9" />
            <Bone className="h-9" />
          </div>
          <Bone className="mt-3 h-3 w-4/5" />
        </div>
      </div>

      {/* Recordes / Marca inicial: one panel. */}
      <div className="mt-7 border-l-2 border-l-[var(--border-strong)] bg-surface-2 px-3 py-2.5">
        <Bone className="h-3 w-1/2" />
        <Bone className="mt-2 h-3 w-4/5" />
      </div>

      <SectionHead label="Exercícios" className="mt-7" />
      <div className="mt-3 flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="reg-frame p-4">
            <div className="flex items-center gap-3">
              <span className="w-5 shrink-0 font-mono text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
              <Bone className="h-4 w-1/2" />
            </div>
            <div className="mt-2.5 flex gap-4 pl-8">
              <Bone className="h-3.5 w-16" />
              <Bone className="h-3.5 w-16" />
              <Bone className="h-3.5 w-16" />
            </div>
            <Bone className="ml-8 mt-3.5 h-2.5 w-24" />
            <Bone className="ml-8 mt-1.5 h-3.5 w-2/5" />
          </div>
        ))}
      </div>
    </SkeletonScreen>
  );
}

/** The summary's own boundary also stands in for "Editar séries" below it until that arrives. */
export default function SummaryLoading() {
  return (
    <NestedSkeleton own={<SummarySkeleton />} routes={[["/app/workout/*/summary/editar", <EditSetsSkeleton key="edit" />]]} />
  );
}
