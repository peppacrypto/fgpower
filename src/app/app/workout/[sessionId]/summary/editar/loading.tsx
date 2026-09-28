import { Bone, SkeletonScreen } from "@/components/ui/skeleton";

const GRID = "grid grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)_3rem_2.75rem] items-center gap-1.5";

/**
 * "Editar séries" (editar/page.tsx) as it lays out: the back link, the kicker
 * and the day's title, the lead, then each exercise's rows of boxes.
 */
export function EditSetsSkeleton() {
  return (
    <SkeletonScreen label="as séries do treino" className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex h-11 items-center">
        <Bone className="h-3.5 w-20" />
      </div>
      <div className="mt-2 flex h-4 items-center">
        <Bone className="h-3 w-48" />
      </div>
      <div className="mt-1 flex h-18 flex-col justify-around sm:h-10">
        <Bone className="h-7 w-3/4 sm:w-1/2" />
        <Bone className="h-7 w-1/2 sm:hidden" />
      </div>
      <Bone className="mt-3 h-3.5 w-full" />
      <Bone className="mt-2 h-3.5 w-4/5" />
      <div className="mt-6 flex flex-col gap-6">
        {[3, 2].map((n, i) => (
          <div key={i}>
            <Bone className="h-4 w-1/2" />
            <div className="mt-4 flex flex-col gap-1.5">
              {Array.from({ length: n }, (_, j) => (
                <div key={j} className={`${GRID} px-1 py-1`}>
                  <span />
                  <Bone className="h-11" />
                  <Bone className="h-11" />
                  <Bone className="h-11" />
                  <Bone className="size-11" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SkeletonScreen>
  );
}

export default EditSetsSkeleton;
