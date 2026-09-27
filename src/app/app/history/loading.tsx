import { Bone, BoneRow, SkeletonScreen, SkeletonTitle } from "@/components/ui/skeleton";
import { NestedSkeleton } from "@/components/ui/skeleton-client";
import { AllHistorySkeleton } from "./all/loading";

/** History: the month calendar and the recent workouts under it. */
function HistorySkeleton() {
  return (
    <SkeletonScreen label="o histórico" className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <SkeletonTitle>Histórico</SkeletonTitle>
      <div className="reg-frame mt-6 p-5">
        <div className="flex items-center justify-between">
          <Bone className="size-8" />
          <Bone className="h-5 w-36" />
          <Bone className="size-8" />
        </div>
        <div className="mt-4 grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }, (_, i) => (
            <div key={i} className="flex aspect-square items-center justify-center">
              <Bone className="size-6" />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-8 flex flex-col gap-2">
        <Bone className="mb-1 h-3.5 w-40" />
        <BoneRow />
        <BoneRow />
      </div>
    </SkeletonScreen>
  );
}

/** Also the fallback for the full list below it, until the list's own arrives. */
export default function HistoryLoading() {
  return <NestedSkeleton own={<HistorySkeleton />} routes={[["/app/history/all", <AllHistorySkeleton key="all" />]]} />;
}
