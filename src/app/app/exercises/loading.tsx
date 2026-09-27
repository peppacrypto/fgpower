import { Bone, SkeletonScreen, SkeletonTitle } from "@/components/ui/skeleton";
import { NestedSkeleton } from "@/components/ui/skeleton-client";
import { ExerciseHistorySkeleton } from "./[slug]/history/loading";
import { ExerciseSkeleton } from "./[slug]/loading";

/** The exercise library: title, search and filters, then the card grid. */
function ExercisesSkeleton() {
  return (
    <SkeletonScreen label="os exercícios" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <SkeletonTitle>Exercícios</SkeletonTitle>
      <Bone className="mt-2 h-3.5 w-4/5 max-w-md" />

      <div className="mt-6 flex flex-col gap-3 lg:flex-row">
        <Bone className="h-11 flex-1" />
        <div className="grid grid-cols-2 gap-2 lg:flex">
          <Bone className="h-11 lg:w-40" />
          <Bone className="h-11 lg:w-40" />
          <Bone className="h-11 lg:w-40" />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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
