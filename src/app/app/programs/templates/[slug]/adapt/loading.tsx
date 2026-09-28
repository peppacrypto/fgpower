import { Bone, SkeletonScreen } from "@/components/ui/skeleton";

/** "Adaptar para halteres": the heading, then a sheet per day with its swaps. */
export function AdaptSkeleton() {
  return (
    <SkeletonScreen label="a adaptação" className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <Bone className="h-3 w-24" />
      <Bone className="mt-4 h-3 w-40" />
      <Bone className="mt-2 h-8 w-3/4" />
      <Bone className="mt-3 h-3.5 w-full" />
      <Bone className="mt-2 h-3.5 w-4/5" />
      <div className="mt-8 flex flex-col gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="border-t-2 border-t-[var(--rule-heavy)] bg-surface">
            <div className="border-b border-border px-4 py-3">
              <Bone className="h-4 w-1/2" />
            </div>
            {[0, 1].map((j) => (
              <div key={j} className="border-b border-border px-4 py-3 last:border-b-0">
                <Bone className="h-3.5 w-2/3" />
                <Bone className="mt-3 h-11 w-full" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </SkeletonScreen>
  );
}

export default AdaptSkeleton;
