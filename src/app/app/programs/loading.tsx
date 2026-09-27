import { Bone, SkeletonScreen } from "@/components/ui/skeleton";
import { NestedSkeleton } from "@/components/ui/skeleton-client";
import { BuilderSkeleton } from "./[id]/edit/loading";
import { ProgramSkeleton } from "./[id]/loading";
import { NewProgramSkeleton } from "./new/loading";
import { TemplateSkeleton } from "./templates/[slug]/loading";

/** Program cards: a heavy top rule, the name, the day tokens and the spec stats. */
function ProgramCardBone() {
  return (
    <div className="flex flex-col border-t-2 border-t-[var(--border-strong)] bg-surface p-5 pt-4">
      <Bone className="h-3 w-28" />
      <Bone className="mt-3 h-5 w-3/4" />
      <Bone className="mt-2 h-3.5 w-11/12" />
      <div className="mt-4 flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <Bone key={i} className="h-6 w-14" />
        ))}
      </div>
      <Bone className="mt-4 h-12 w-full" />
    </div>
  );
}

/** Programs: the masthead, then the shelf of programs and the library. */
function ProgramsSkeleton() {
  return (
    <SkeletonScreen label="os programas" className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex items-end justify-between gap-4">
        <div>
          <Bone className="h-3 w-24" />
          <div className="text-display mt-1 text-4xl font-extrabold sm:text-5xl">Programas</div>
          <Bone className="mt-3 h-3 w-40" />
        </div>
        <Bone className="h-11 w-24" />
      </div>
      <Bone className="mt-8 h-11 w-full" />
      <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
        <ProgramCardBone />
        <ProgramCardBone />
        <ProgramCardBone />
        <ProgramCardBone />
      </div>
    </SkeletonScreen>
  );
}

/** Also the fallback for every page below /app/programs, until that page's own arrives. */
export default function ProgramsLoading() {
  return (
    <NestedSkeleton
      own={<ProgramsSkeleton />}
      routes={[
        ["/app/programs/new", <NewProgramSkeleton key="new" />],
        ["/app/programs/templates/*", <TemplateSkeleton key="template" />],
        ["/app/programs/*/edit", <BuilderSkeleton key="edit" />],
        ["/app/programs/*", <ProgramSkeleton key="program" />],
      ]}
    />
  );
}
