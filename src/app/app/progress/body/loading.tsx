import { Bone, SkeletonScreen, SkeletonTitle } from "@/components/ui/skeleton";
import { SectionHead } from "@/components/ui/section-head";

/** Corpo: back link, title and lead, the period chips, the weigh-in form, the chart and the measurements. */
export function BodySkeleton() {
  return (
    <SkeletonScreen label="os dados do seu corpo" className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <Bone className="h-3 w-24" />
      <SkeletonTitle className="mt-3">Corpo</SkeletonTitle>
      <Bone className="mt-2 h-3.5 w-3/4" />
      <div className="mt-4 flex flex-wrap gap-1.5">
        {["w-20", "w-20", "w-16", "w-16", "w-12", "w-12"].map((w, i) => (
          <Bone key={i} className={`h-11 ${w}`} />
        ))}
      </div>
      <SectionHead label="Peso" className="mt-6" />
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <Bone className="h-11 w-40" />
        <Bone className="h-11 w-28" />
        <Bone className="h-11 w-24" />
      </div>
      <Bone className="mt-6 h-3 w-24" />
      <Bone className="mt-2 h-4 w-40" />
      <Bone className="mt-3 h-32 w-full" />
      <SectionHead label="Medidas" className="mt-10" />
      <Bone className="mt-4 h-11 w-40" />
    </SkeletonScreen>
  );
}

export default BodySkeleton;
