import { Bone, SkeletonScreen, SkeletonTitle } from "@/components/ui/skeleton";
import { SectionHead } from "@/components/ui/section-head";

/** Corpo: back link, title and lead, the period chips, the weigh-in form, the chart and the measurements. */
export function BodySkeleton() {
  return (
    <SkeletonScreen label="os dados do seu corpo" className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="-mt-2 flex h-11 items-center">
        <Bone className="h-3.5 w-24" />
      </div>
      <SkeletonTitle className="text-[1.75rem] leading-tight sm:text-[2rem]">Corpo</SkeletonTitle>
      <Bone className="mt-2.5 h-3.5 w-3/4" />
      <div className="mt-5 grid grid-cols-3 gap-1.5 sm:flex">
        {["sm:w-24", "sm:w-24", "sm:w-20", "sm:w-20", "sm:w-16", "sm:w-14"].map((w, i) => (
          <Bone key={i} className={`h-11 ${w}`} />
        ))}
      </div>
      <SectionHead label="Peso" className="mt-8" />
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <Bone className="h-11 w-40" />
        <Bone className="h-11 w-28" />
        <Bone className="h-11 w-24" />
      </div>
      <div className="card mt-5 p-4 sm:p-5">
        <Bone className="h-3.5 w-24" />
        <Bone className="mt-2 h-4 w-40" />
        <Bone className="mt-3 h-32 w-full" />
      </div>
      <SectionHead label="Medidas" className="mt-10" />
      <Bone className="mt-4 h-11 w-40" />
    </SkeletonScreen>
  );
}

export default BodySkeleton;
