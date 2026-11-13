import { Bone, SkeletonScreen, SkeletonTitle } from "@/components/ui/skeleton";

/** Dieta: back link, title, the day's arrows, the targets card and the first meal's items. */
export default function DietLoading() {
  return (
    <SkeletonScreen label="a sua dieta" className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="-mt-2 flex h-11 items-center">
        <Bone className="h-3.5 w-16" />
      </div>
      <SkeletonTitle className="text-[1.75rem] leading-tight sm:text-[2rem]">Dieta</SkeletonTitle>
      <Bone className="mt-2.5 h-3.5 w-2/3" />
      <div className="mt-5 flex items-center gap-2">
        <Bone className="size-11 shrink-0" />
        <div className="flex flex-1 flex-col items-center gap-1.5">
          <Bone className="h-4 w-16" />
          <Bone className="h-3 w-28" />
        </div>
        <Bone className="size-11 shrink-0" />
      </div>
      <div className="card mt-5 p-4 sm:p-5">
        <Bone className="h-4 w-28" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="mt-4">
            <Bone className="h-3.5 w-full" />
            <Bone className="mt-2 h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
      <Bone className="mt-8 h-4 w-36" />
      <div className="card mt-3 divide-y divide-border">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex min-h-16 items-center gap-3 px-4 py-3">
            <Bone className="size-7 shrink-0 rounded-full" />
            <div className="flex-1">
              <Bone className="h-4 w-2/3" />
              <Bone className="mt-1.5 h-3 w-1/3" />
            </div>
            <Bone className="h-4 w-14" />
          </div>
        ))}
      </div>
    </SkeletonScreen>
  );
}
