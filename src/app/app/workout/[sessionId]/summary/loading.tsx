import { Bone, SkeletonScreen } from "@/components/ui/skeleton";
import { SectionHead } from "@/components/ui/section-head";
import { NestedSkeleton } from "@/components/ui/skeleton-client";
import { EditSetsSkeleton } from "./editar/loading";

/**
 * The post-workout summary (summary/page.tsx), drawn as it lays out: the
 * masthead panel (the date line, the day's title, "Treino nº · week", the
 * three figures, the saved line), the records or the baseline, the check-in
 * folded to its one line, the share block ("Quem vê", then "Fora do app"),
 * then the exercise cards. Keep in step with the page.
 */
export function SummarySkeleton() {
  return (
    <SkeletonScreen label="o resumo do treino" className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      {/* The masthead panel: "Treino concluído · date" and "⋯", the day's title (two lines on a
          phone), Treino nº · week, the duration / sets / volume figures, "Salvo no histórico ✓". */}
      <div className="panel">
        <div className="p-5 sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-[26px] items-end">
              <Bone className="h-3 w-44" />
            </div>
            <span className="-mr-1 -mt-1.5 size-11 shrink-0" />
          </div>
          <div className="mt-1 flex h-[70px] flex-col justify-around sm:h-10">
            <Bone className="h-6 w-3/4 sm:w-1/2" />
            <Bone className="h-6 w-1/2 sm:hidden" />
          </div>
          <div className="mt-1 flex h-5 items-center">
            <Bone className="h-3 w-36" />
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[78px] rounded-[var(--radius-md)] bg-surface-2 px-3 py-3">
                <Bone className="h-5 w-12 bg-[var(--border)]" />
                <Bone className="mt-2.5 h-3 w-4/5 bg-[var(--border)]" />
              </div>
            ))}
          </div>
          <div className="mt-4 flex h-5 items-center">
            <Bone className="h-3 w-36" />
          </div>
        </div>
      </div>

      {/* Recordes / Marca inicial. */}
      <div className="mt-6 rounded-[var(--radius-lg)] bg-surface-2 px-4 py-3">
        <Bone className="h-3.5 w-1/2" />
        <Bone className="mt-2 h-3 w-4/5" />
      </div>

      {/* The check-in (check-in-card.tsx) as one line: answered or skipped, it folds to 52px. */}
      <div className="card mt-5 flex h-[52px] items-center px-4">
        <Bone className="h-3 w-40" />
      </div>

      {/* Quem vê: its label above the three-way switch, then who that is; then
          "Fora do app" with its two buttons (side by side from 360px) and the
          helper line. */}
      <div className="mt-6 border-t border-border pt-5">
        <div className="flex flex-col items-stretch gap-2">
          <div className="flex h-5 items-center">
            <Bone className="h-3 w-14 shrink-0" />
          </div>
          <Bone className="h-12 sm:max-w-md" />
        </div>
        <Bone className="mt-3.5 h-3 w-2/5" />
        <div className="mt-3.5 border-t border-border pt-3">
          <div className="flex h-5 items-center">
            <Bone className="h-3 w-20" />
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
            <Bone className="h-9" />
            <Bone className="h-9" />
          </div>
          <Bone className="mt-3 h-3 w-4/5" />
        </div>
      </div>

      <SectionHead label="Exercícios" className="mt-10" />
      <div className="mt-3 flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card p-4 sm:p-5">
            <Bone className="h-4 w-1/2" />
            <div className="mt-3 flex gap-4">
              <Bone className="h-3.5 w-16" />
              <Bone className="h-3.5 w-16" />
              <Bone className="h-3.5 w-16" />
            </div>
            <div className="mt-3 border-t border-border pt-3">
              <Bone className="h-3 w-24" />
              <Bone className="mt-2 h-3.5 w-2/5" />
            </div>
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
