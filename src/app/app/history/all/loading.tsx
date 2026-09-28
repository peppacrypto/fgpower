import { Bone, BoneRow, SkeletonScreen } from "@/components/ui/skeleton";

/** Every workout, as a list grouped by week. */
export function AllHistorySkeleton() {
  return (
    <SkeletonScreen label="todos os treinos" className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <Bone className="h-3 w-20" />
      <Bone className="mt-3 h-8 w-56" />
      {[3, 2].map((n, g) => (
        <div key={g} className="mt-6 flex flex-col gap-2">
          <Bone className="mb-1 h-3 w-48" />
          {Array.from({ length: n }, (_, i) => (
            <BoneRow key={i} />
          ))}
        </div>
      ))}
    </SkeletonScreen>
  );
}

export default AllHistorySkeleton;
