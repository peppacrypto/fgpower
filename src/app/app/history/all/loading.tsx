import { Bone, BoneRow, SkeletonScreen } from "@/components/ui/skeleton";

/** Every workout, as a list grouped by week. */
export function AllHistorySkeleton() {
  return (
    <SkeletonScreen label="todos os treinos" className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="-mt-2 flex h-11 items-center">
        <Bone className="h-3.5 w-20" />
      </div>
      <Bone className="h-8 w-56 max-w-full" />
      {[3, 2].map((n, g) => (
        <div key={g} className={g === 0 ? "mt-8 flex flex-col gap-2" : "mt-10 flex flex-col gap-2"}>
          <Bone className="mb-1.5 h-4 w-48" />
          {Array.from({ length: n }, (_, i) => (
            <BoneRow key={i} />
          ))}
        </div>
      ))}
    </SkeletonScreen>
  );
}

export default AllHistorySkeleton;
