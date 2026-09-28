import { Bone, BoneRow, SkeletonScreen, SkeletonTitle } from "@/components/ui/skeleton";

/** Every trained exercise, as a list with a trend on each row. */
export function MyExercisesSkeleton() {
  return (
    <SkeletonScreen label="os seus exercícios" className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <Bone className="h-3 w-24" />
      <SkeletonTitle className="mt-3">Meus exercícios</SkeletonTitle>
      <Bone className="mt-2 h-3.5 w-3/4" />
      <div className="mt-6 flex flex-col gap-2">
        <Bone className="mb-1 h-3 w-28" />
        {Array.from({ length: 6 }, (_, i) => (
          <BoneRow key={i} />
        ))}
      </div>
    </SkeletonScreen>
  );
}

export default MyExercisesSkeleton;
