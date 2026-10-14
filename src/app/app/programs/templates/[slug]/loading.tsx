import { Bone, BoneLines, SkeletonScreen } from "@/components/ui/skeleton";
import { NestedSkeleton } from "@/components/ui/skeleton-client";
import { AdaptSkeleton } from "./adapt/loading";

/** A program's page: the masthead with its weekly demand and actions, then the sessions. */
export function TemplateSkeleton() {
  return (
    <SkeletonScreen label="o programa" className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="panel @container p-5 sm:p-8">
        <Bone className="h-3 w-24" />
        <Bone className="mt-3 h-8 w-3/5" />
        <BoneLines lines={2} className="mt-3" />
        <div className="mt-5 grid grid-cols-2 gap-2 @lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rounded-[var(--radius-md)] bg-surface-2 px-3 py-2.5">
              <Bone className="h-2.5 w-14" />
              <Bone className="mt-2 h-4 w-20" />
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Bone className="h-13 w-56" />
          <Bone className="h-13 w-36" />
        </div>
      </div>
      <div className="mt-10 flex flex-col gap-4">
        <Bone className="h-4 w-40" />
        {[0, 1].map((i) => (
          <div key={i} className="card overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <Bone className="h-4 w-1/2" />
              <Bone className="h-3 w-16" />
            </div>
            {[0, 1, 2].map((j) => (
              <div key={j} className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0">
                <Bone className="h-3.5 w-3/5" />
                <Bone className="h-3.5 w-12" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </SkeletonScreen>
  );
}

/** Also the fallback for "Adaptar" below it, until that page's own arrives. */
export default function TemplateLoading() {
  return (
    <NestedSkeleton own={<TemplateSkeleton />} routes={[["/app/programs/templates/*/adapt", <AdaptSkeleton key="adapt" />]]} />
  );
}
