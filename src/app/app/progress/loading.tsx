import { Bone, BoneRow, SkeletonScreen, SkeletonTitle } from "@/components/ui/skeleton";

/** Progress: title, period chips, the two stat panels and the per-exercise list. */
export default function ProgressLoading() {
  return (
    <SkeletonScreen label="o seu progresso" className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-baseline justify-between gap-4">
        <SkeletonTitle>Progresso</SkeletonTitle>
        <Bone className="h-3 w-20" />
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {["w-20", "w-20", "w-16", "w-16", "w-12", "w-12"].map((w, i) => (
          <Bone key={i} className={`h-11 ${w}`} />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="reg-frame p-5">
            <Bone className="h-3 w-3/4" />
            <Bone className="mt-3 h-7 w-12" />
          </div>
        ))}
      </div>
      <div className="reg-frame mt-3 flex items-center justify-between px-5 py-4">
        <div>
          <Bone className="h-3 w-24" />
          <Bone className="mt-2 h-4 w-32" />
        </div>
        <Bone className="h-6 w-20" />
      </div>
      <div className="mt-8 flex flex-col gap-2">
        <Bone className="mb-1 h-3.5 w-48" />
        <BoneRow />
        <BoneRow />
        <BoneRow />
      </div>
    </SkeletonScreen>
  );
}
