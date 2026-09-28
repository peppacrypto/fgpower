import { Bone, BoneLines, SkeletonScreen } from "@/components/ui/skeleton";
import { NestedSkeleton } from "@/components/ui/skeleton-client";
import { AdaptSkeleton } from "./adapt/loading";

/** A program's dossier: the masthead band with its stats and actions, then the day sheets. */
export function TemplateSkeleton() {
  return (
    <SkeletonScreen label="o programa" className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="panel-raised relative p-6 sm:p-8">
        <span className="absolute left-0 top-0 h-full w-1.5 bg-[var(--border-strong)]" />
        <div className="flex gap-2">
          <Bone className="h-3 w-16" />
          <Bone className="h-3 w-24" />
        </div>
        <Bone className="mt-4 h-9 w-2/5" />
        <BoneLines lines={3} className="mt-4" />
        <div className="mt-6 grid grid-cols-3 divide-x divide-border border-y border-border py-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <Bone className="h-6 w-10" />
              <Bone className="h-2.5 w-14" />
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Bone className="h-13 w-56" />
          <Bone className="h-13 w-36" />
        </div>
      </div>
      <div className="mt-10 flex flex-col gap-3">
        <Bone className="h-3 w-40" />
        {[0, 1].map((i) => (
          <div key={i} className="border-t-2 border-t-[var(--rule-heavy)] bg-surface">
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <Bone className="h-4 w-6" />
              <Bone className="h-4 w-1/2" />
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
