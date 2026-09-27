import { Bone, BoneRow, SkeletonScreen } from "@/components/ui/skeleton";

/** Every workout, as a list. */
export function AllHistorySkeleton() {
  return (
    <SkeletonScreen label="todos os treinos" className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <Bone className="h-8 w-56" />
      <div className="mt-6 flex flex-col gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <BoneRow key={i} />
        ))}
      </div>
    </SkeletonScreen>
  );
}

export default AllHistorySkeleton;
