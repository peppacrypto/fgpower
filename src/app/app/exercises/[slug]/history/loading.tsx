import { Bone, BoneRow, SkeletonScreen } from "@/components/ui/skeleton";

/** An exercise's history: its name, best marks, the period chips, the charts and the past sessions. */
export function ExerciseHistorySkeleton() {
  return (
    <SkeletonScreen label="o histórico do exercício" className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <Bone className="h-8 w-3/4" />
      <Bone className="mt-2 h-3.5 w-1/2" />
      <Bone className="mt-7 h-3 w-32" />
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[0, 1].map((i) => (
          <div key={i} className="reg-frame px-5 py-3.5">
            <Bone className="h-3 w-2/3" />
            <Bone className="mt-2 h-5 w-1/2" />
            <Bone className="mt-2 h-2.5 w-12" />
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-1.5">
        {["w-20", "w-20", "w-16", "w-16", "w-12", "w-12"].map((w, i) => (
          <Bone key={i} className={`h-11 ${w}`} />
        ))}
      </div>
      <div className="reg-frame mt-4 p-5">
        <Bone className="h-3 w-1/3" />
        <Bone className="mt-2 h-3.5 w-2/3" />
        <Bone className="mt-4 h-32 w-full" />
      </div>
      <div className="mt-8 flex flex-col gap-2">
        <BoneRow />
        <BoneRow />
        <BoneRow />
      </div>
    </SkeletonScreen>
  );
}

export default ExerciseHistorySkeleton;
