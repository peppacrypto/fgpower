import { Bone, SkeletonScreen } from "@/components/ui/skeleton";

/** The builder: the masthead card (name, description, cadence), the volume bar, the day tabs, the day's card and folded exercise rows. */
export function BuilderSkeleton() {
  return (
    <SkeletonScreen label="o editor do programa" className="mx-auto max-w-3xl px-4 pb-6 pt-3 sm:px-6 sm:py-8">
      <Bone className="my-4 h-3 w-24" />
      <div className="eyebrow mt-1">Editar programa</div>
      <div className="panel mt-4 p-4 sm:p-6">
        <Bone className="h-8 w-3/5" />
        <Bone className="mt-3 h-4 w-2/5" />
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4">
          <Bone className="h-11 w-full" />
          <Bone className="h-11 w-full" />
        </div>
      </div>
      <Bone className="mt-4 h-11 w-full rounded-[var(--radius-lg)]" />
      <div className="mt-6 flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <Bone key={i} className="h-11 w-20 shrink-0 rounded-[var(--radius-md)]" />
        ))}
      </div>
      <Bone className="mt-3 h-20 w-full rounded-[var(--radius-lg)]" />
      <div className="mt-5 flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card flex items-center gap-3 px-3 py-3">
            <Bone className="size-12 shrink-0 rounded-[var(--radius-md)]" />
            <div className="flex-1">
              <Bone className="h-4 w-3/4" />
              <Bone className="mt-1.5 h-3 w-1/2" />
            </div>
            <Bone className="size-6 shrink-0" />
          </div>
        ))}
      </div>
      <Bone className="mt-3 h-11 w-full rounded-[var(--radius-md)]" />
    </SkeletonScreen>
  );
}

export default BuilderSkeleton;
