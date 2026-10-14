import { Bone, SkeletonMasthead, SkeletonScreen } from "@/components/ui/skeleton";
import { NestedSkeleton } from "@/components/ui/skeleton-client";
import { ExerciseHistorySkeleton } from "./[slug]/history/loading";
import { ExerciseSkeleton } from "./[slug]/loading";

const LABEL = "text-[13px] font-medium text-muted";

/** The exercise library: masthead, search, the muscle chips, equipment + "Mais filtros", then the cards (a list on a phone). */
function ExercisesSkeleton() {
  return (
    <SkeletonScreen label="os exercícios" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <SkeletonMasthead kicker="Técnica e ciência" title="Exercícios" />

      <div className="mt-6">
        <Bone className="h-12 w-full rounded-[var(--radius-md)]" />
        <div className="mt-4 flex items-center gap-2 overflow-hidden">
          <span className={`${LABEL} w-16 shrink-0`}>Músculo</span>
          {Array.from({ length: 6 }, (_, i) => (
            <Bone key={i} className="h-9 w-16 shrink-0" />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 overflow-hidden">
          <span className={`${LABEL} w-16 shrink-0`}>Lista</span>
          <Bone className="h-9 w-32 shrink-0" />
          <Bone className="h-9 w-24 shrink-0" />
        </div>
        <div className="mt-3 flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <span className={LABEL}>Equipamento</span>
            <Bone className="mt-1.5 h-11 w-full rounded-[var(--radius-md)]" />
          </div>
          <Bone className="h-11 w-36 shrink-0 rounded-[var(--radius-md)]" />
        </div>
        <div className="mt-7 flex items-baseline gap-3">
          <span className="flex-1 text-[17px] font-semibold leading-snug">Biblioteca</span>
          <Bone className="h-3.5 w-36" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="card flex items-center gap-3 overflow-hidden p-2 sm:flex-col sm:items-stretch sm:gap-0 sm:p-0">
            <Bone className="aspect-[4/3] w-24 shrink-0 rounded-[var(--radius-md)] sm:w-full sm:rounded-none" />
            <div className="flex min-w-0 flex-1 flex-col gap-2 py-1 sm:p-4 sm:pt-3.5">
              <Bone className="h-4 w-4/5" />
              <Bone className="h-3 w-3/5" />
              <Bone className="h-3 w-2/5 sm:mt-6" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonScreen>
  );
}

/** Also the fallback for each exercise page (and its history), until that page's own arrives. */
export default function ExercisesLoading() {
  return (
    <NestedSkeleton
      own={<ExercisesSkeleton />}
      routes={[
        ["/app/exercises/*/history", <ExerciseHistorySkeleton key="history" />],
        ["/app/exercises/*", <ExerciseSkeleton key="exercise" />],
      ]}
    />
  );
}
