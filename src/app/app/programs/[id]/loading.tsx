import { Bone, SkeletonScreen } from "@/components/ui/skeleton";
import { NestedSkeleton } from "@/components/ui/skeleton-client";
import { BuilderSkeleton } from "./edit/loading";

/** One of the user's programs: its name and actions, then a card per day. */
export function ProgramSkeleton() {
  return (
    <SkeletonScreen label="o programa" className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <Bone className="h-8 w-1/2" />
      <Bone className="mt-2 h-3.5 w-2/3" />
      <div className="mt-5 flex flex-wrap gap-2">
        <Bone className="h-11 w-36" />
        <Bone className="h-11 w-24" />
      </div>
      <div className="mt-8 flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="reg-frame p-5">
            <div className="flex items-center justify-between gap-3">
              <Bone className="h-5 w-1/2" />
              <Bone className="h-9 w-20" />
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <Bone className="h-3.5 w-3/4" />
              <Bone className="h-3.5 w-2/3" />
              <Bone className="h-3.5 w-3/5" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonScreen>
  );
}

/** Also the fallback for the builder below it, until the builder's own arrives. */
export default function ProgramLoading() {
  return <NestedSkeleton own={<ProgramSkeleton />} routes={[["/app/programs/*/edit", <BuilderSkeleton key="edit" />]]} />;
}
