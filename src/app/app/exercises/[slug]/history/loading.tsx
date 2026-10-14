import { Bone, BoneRow, SkeletonScreen } from "@/components/ui/skeleton";

/** An exercise's history: its name, best marks, the period chips, the charts and the past sessions. */
export function ExerciseHistorySkeleton() {
  return (
    <SkeletonScreen label="o histórico do exercício" className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <span className="eyebrow">Meu histórico</span>
      <Bone className="mt-1.5 h-8 w-3/4" />
      <Bone className="mt-2.5 h-4 w-1/2" />
      <Bone className="mt-9 h-4 w-36" />
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="card p-4">
            <Bone className="h-3.5 w-2/3" />
            <Bone className="mt-2 h-6 w-1/2" />
            <Bone className="mt-2 h-3 w-12" />
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-1.5">
        {["w-20", "w-20", "w-16", "w-16", "w-12", "w-12"].map((w, i) => (
          <Bone key={i} className={`h-11 ${w}`} />
        ))}
      </div>
      <div className="card mt-4 p-5">
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
