import { Bone, SkeletonMasthead, SkeletonScreen } from "@/components/ui/skeleton";
import { NestedSkeleton } from "@/components/ui/skeleton-client";
import { ExerciseHistorySkeleton } from "./[slug]/history/loading";
import { ExerciseSkeleton } from "./[slug]/loading";

const MICRO = "font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted";

/** The exercise library: masthead, search, the muscle chips, equipment + "Mais filtros", then the card grid. */
function ExercisesSkeleton() {
  return (
    <SkeletonScreen label="os exercícios" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <SkeletonMasthead kicker="Técnica e ciência" title="Exercícios" />

      <div className="mt-6">
        <Bone className="h-11 w-full" />
        <div className="mt-4 flex items-center gap-2 overflow-hidden">
          <span className={`${MICRO} w-16 shrink-0`}>Músculo</span>
          {Array.from({ length: 6 }, (_, i) => (
            <Bone key={i} className="h-8 w-16 shrink-0" />
          ))}
        </div>
        <div className="mt-1.5 flex items-center gap-2 overflow-hidden">
          <span className={`${MICRO} w-16 shrink-0`}>Lista</span>
          <Bone className="h-8 w-32 shrink-0" />
          <Bone className="h-8 w-24 shrink-0" />
        </div>
        <div className="mt-3 flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <span className={MICRO}>Equipamento</span>
            <Bone className="mt-1 h-11 w-full" />
          </div>
          <Bone className="h-11 w-32 shrink-0" />
        </div>
        <div className="mt-6 flex items-center gap-4">
          <Bone className="h-3 w-20" />
          <span className="h-px flex-1 bg-border" />
          <Bone className="h-3 w-24" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="reg-frame flex flex-col">
            <Bone className="aspect-[4/3] w-full rounded-b-none" />
            <div className="flex flex-col gap-2 p-3.5">
              <Bone className="h-4 w-4/5" />
              <Bone className="h-3 w-3/5" />
              <Bone className="mt-1 h-5 w-16" />
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
