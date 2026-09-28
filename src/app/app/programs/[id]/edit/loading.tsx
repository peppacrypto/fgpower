import { Bone, SkeletonScreen } from "@/components/ui/skeleton";

/** The builder: name and description, the cadence, the volume line, the day tabs and folded exercise rows. */
export function BuilderSkeleton() {
  return (
    <SkeletonScreen label="o editor do programa" className="mx-auto max-w-3xl px-4 pb-6 pt-3 sm:px-6 sm:py-8">
      <Bone className="my-4 h-3 w-24" />
      <div className="mt-1 font-mono text-[11px] font-bold uppercase tracking-[0.2em]">Editar programa</div>
      <Bone className="mt-4 h-8 w-3/5" />
      <Bone className="mt-3 h-4 w-2/5" />
      <div className="mt-5 grid grid-cols-2 gap-3 border-y border-border py-3">
        <Bone className="h-11 w-full" />
        <Bone className="h-11 w-full" />
      </div>
      <Bone className="mt-4 h-11 w-full" />
      <div className="mt-4 flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <Bone key={i} className="h-11 w-20 shrink-0" />
        ))}
      </div>
      <Bone className="h-20 w-full" />
      <div className="mt-4 flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="reg-frame flex items-center gap-3 px-3 py-3">
            <Bone className="size-9 shrink-0" />
            <div className="flex-1">
              <Bone className="h-4 w-3/4" />
              <Bone className="mt-1.5 h-3 w-1/2" />
            </div>
            <Bone className="size-6 shrink-0" />
          </div>
        ))}
      </div>
      <Bone className="mt-3 h-11 w-full" />
    </SkeletonScreen>
  );
}

export default BuilderSkeleton;
