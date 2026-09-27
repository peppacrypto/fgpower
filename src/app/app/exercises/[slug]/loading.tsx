import { Bone, BoneLines, SkeletonScreen } from "@/components/ui/skeleton";
import { NestedSkeleton } from "@/components/ui/skeleton-client";
import { ExerciseHistorySkeleton } from "./history/loading";

/** An exercise page: the two technique frames, the name and the attribute grid. */
export function ExerciseSkeleton() {
  return (
    <SkeletonScreen label="o exercício" className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="reg-frame flex gap-2">
          <Bone className="aspect-[3/4] flex-1" />
          <Bone className="aspect-[3/4] flex-1" />
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Bone className="h-8 w-11/12" />
              <Bone className="mt-2 h-8 w-1/2" />
            </div>
            <Bone className="size-11 shrink-0" />
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i}>
                <Bone className="h-3.5 w-3/5" />
                <Bone className="mt-1.5 h-4 w-4/5" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-10 border-t border-border pt-6">
        <Bone className="h-3 w-36" />
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
