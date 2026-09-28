import { Bone, BoneRow, SkeletonMasthead, SkeletonScreen } from "@/components/ui/skeleton";
import { NestedSkeleton } from "@/components/ui/skeleton-client";
import { AllHistorySkeleton } from "./all/loading";

/** History: the month calendar and the recent workouts under it. */
function HistorySkeleton() {
  return (
    <SkeletonScreen label="o histórico" className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <SkeletonMasthead kicker="Seus treinos" title="Histórico" lead={false} />
      <div className="reg-frame mt-6 px-3 pt-3 pb-4 sm:px-5">
        <div className="flex items-center justify-between">
          <Bone className="size-11" />
          <div className="flex flex-col items-center gap-1.5">
            <Bone className="h-5 w-36" />
            <Bone className="h-2.5 w-44" />
          </div>
          <Bone className="size-11" />
        </div>
        <div className="mt-3 grid grid-cols-[repeat(7,minmax(0,1fr))_1rem] gap-1 text-center font-mono text-[10px] tracking-wider text-muted">
          {["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM", ""].map((d, i) => (
            <div key={i}>{d}</div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-[repeat(7,minmax(0,1fr))_1rem] gap-1">
          {Array.from({ length: 40 }, (_, i) =>
            i % 8 === 7 ? (
              <span key={i} />
            ) : (
              <div key={i} className="flex aspect-square items-center justify-center">
                <Bone className="size-6" />
              </div>
            ),
          )}
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
