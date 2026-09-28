import { Bone, SkeletonScreen, SkeletonTitle } from "@/components/ui/skeleton";
import { NestedSkeleton } from "@/components/ui/skeleton-client";
import { MyExercisesSkeleton } from "./exercises/loading";

/** Progress: title, period chips, the two stat panels, the program card and the per-exercise list. */
function ProgressSkeleton() {
  return (
    <SkeletonScreen label="o seu progresso" className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-baseline justify-between gap-4">
        <SkeletonTitle>Progresso</SkeletonTitle>
        <Bone className="h-3 w-20" />
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {["w-20", "w-20", "w-16", "w-16", "w-12", "w-12"].map((w, i) => (
          <Bone key={i} className={`h-11 ${w}`} />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="reg-frame p-5">
            <Bone className="h-3 w-3/4" />
            <Bone className="mt-3 h-7 w-12" />
          </div>
        ))}
      </div>
      <div className="reg-frame mt-3 px-5 py-4">
        <Bone className="h-3 w-24" />
        <Bone className="mt-2 h-4 w-32" />
        <Bone className="mt-4 h-3.5 w-28" />
        <Bone className="mt-2.5 h-1.5 w-full" />
        <Bone className="mt-2.5 h-3 w-48" />
      </div>
      <div className="mt-8 flex flex-col gap-2">
        <Bone className="mb-1 h-3.5 w-48" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="reg-frame px-5 py-3.5">
            <div className="flex items-center justify-between gap-4">
              <Bone className="h-4 w-2/5" />
              <Bone className="h-4 w-10" />
            </div>
            <div className="mt-2 flex items-center justify-between gap-4">
              <Bone className="h-3 w-1/2" />
              <Bone className="h-5 w-14" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonScreen>
  );
}

/** Also the fallback for "Meus exercícios" below it, until that page's own arrives. */
export default function ProgressLoading() {
  return (
    <NestedSkeleton
      own={<ProgressSkeleton />}
      routes={[["/app/progress/exercises", <MyExercisesSkeleton key="exercises" />]]}
    />
  );
}
