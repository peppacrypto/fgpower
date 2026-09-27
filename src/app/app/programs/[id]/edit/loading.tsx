import { Bone, SkeletonScreen } from "@/components/ui/skeleton";

/** The builder: name and description, the day tabs, the day bar and the exercise rows. */
export function BuilderSkeleton() {
  return (
    <SkeletonScreen label="o editor do programa" className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <Bone className="mb-3 h-3 w-24" />
      <Bone className="mt-6 h-8 w-3/5" />
      <Bone className="mt-3 h-4 w-2/5" />
      <div className="mt-6 flex flex-wrap gap-2">
        <Bone className="h-10 w-28" />
        <Bone className="h-10 w-24" />
        <Bone className="h-10 w-16" />
      </div>
      <Bone className="mt-4 h-14 w-full rounded-[var(--radius-md)]" />
      <div className="mt-4 flex flex-col gap-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="reg-frame p-4">
            <div className="flex items-center gap-3">
              <Bone className="size-8 shrink-0" />
              <Bone className="h-4 flex-1" />
              <Bone className="size-8 shrink-0" />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {Array.from({ length: 6 }, (_, j) => (
                <Bone key={j} className="h-11" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <Bone className="mt-3 h-11 w-full" />
    </SkeletonScreen>
  );
}

export default BuilderSkeleton;
