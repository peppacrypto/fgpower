import { Bone, BoneRow, SkeletonScreen } from "@/components/ui/skeleton";

/** An exercise's history: its name, the progression chart and the past sessions. */
export function ExerciseHistorySkeleton() {
  return (
    <SkeletonScreen label="o histórico do exercício" className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <Bone className="h-8 w-3/4" />
      <div className="reg-frame mt-8 p-5">
        <Bone className="h-3.5 w-1/3" />
        <Bone className="mt-4 h-40 w-full" />
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
