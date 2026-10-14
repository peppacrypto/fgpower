import { Bone, BoneLines, SkeletonScreen } from "@/components/ui/skeleton";
import { NestedSkeleton } from "@/components/ui/skeleton-client";
import { ExerciseHistorySkeleton } from "./history/loading";

/** An exercise page: the technique frames, the name, its kind line and the chip rows, then the steps. */
export function ExerciseSkeleton() {
  return (
    <SkeletonScreen label="o exercício" className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      {/* "‹ Exercícios" */}
      <div className="-mt-2 mb-2 flex h-11 items-center">
        <Bone className="h-3.5 w-24" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
        <div className="-mx-4 flex gap-2 overflow-hidden px-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-3 sm:px-0 lg:grid-cols-1">
          <Bone className="aspect-[4/3] w-[84%] shrink-0 rounded-[var(--radius-lg)] sm:w-auto" />
          <Bone className="aspect-[4/3] w-[84%] shrink-0 rounded-[var(--radius-lg)] sm:w-auto" />
        </div>
        <div className="flex flex-col gap-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Bone className="h-8 w-11/12" />
              <Bone className="mt-2.5 h-4 w-1/2" />
            </div>
            <Bone className="size-11 shrink-0 rounded-[var(--radius-md)]" />
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i}>
                <Bone className="h-3.5 w-2/5" />
                <div className="mt-2 flex gap-1.5">
                  <Bone className="h-7 w-20" />
                  <Bone className="h-7 w-16" />
                </div>
              </div>
            ))}
          </div>
          <Bone className="h-11 w-36 rounded-[var(--radius-md)]" />
        </div>
      </div>
      <div className="mt-10 max-w-3xl">
        <div className="flex items-baseline gap-3">
          <span className="flex-1 text-[17px] font-semibold leading-snug">Como executar</span>
          <Bone className="h-3.5 w-16" />
        </div>
        <BoneLines lines={4} className="mt-4" />
      </div>
    </SkeletonScreen>
  );
}

/** Also the fallback for the exercise's history, until the history's own arrives. */
export default function ExerciseLoading() {
  return (
    <NestedSkeleton own={<ExerciseSkeleton />} routes={[["/app/exercises/*/history", <ExerciseHistorySkeleton key="history" />]]} />
  );
}
