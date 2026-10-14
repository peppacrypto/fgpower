import { Bone, SkeletonScreen } from "@/components/ui/skeleton";
import { NestedSkeleton } from "@/components/ui/skeleton-client";
import { BuilderSkeleton } from "./[id]/edit/loading";
import { ProgramSkeleton } from "./[id]/loading";
import { NewProgramSkeleton } from "./new/loading";
import { TemplateSkeleton } from "./templates/[slug]/loading";
import { AdaptSkeleton } from "./templates/[slug]/adapt/loading";

/** Program cards: the name, its purpose, the weekly commitment and the level line. */
function ProgramCardBone() {
  return (
    <div className="card flex flex-col p-4 sm:p-5">
      <Bone className="h-5 w-3/4" />
      <Bone className="mt-2 h-3.5 w-11/12" />
      <Bone className="mt-1.5 h-3.5 w-2/3" />
      <Bone className="mt-4 h-4 w-1/2" />
      <Bone className="mt-2 h-3 w-2/5" />
    </div>
  );
}

/** Programs: the masthead, then the shelf of programs and the library. */
function ProgramsSkeleton() {
  return (
    <SkeletonScreen label="os programas" className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <Bone className="h-3 w-24" />
          <div className="text-display mt-1 text-[1.75rem] font-semibold leading-tight sm:text-[2rem]">Programas</div>
          <Bone className="mt-2.5 h-3 w-40" />
        </div>
        <Bone className="h-11 w-24" />
      </div>
      <Bone className="mt-6 h-11 w-full" />
      <div className="mt-10 flex gap-2 overflow-hidden">
        {[0, 1, 2, 3, 4].map((i) => (
          <Bone key={i} className="h-9 w-24 shrink-0" />
        ))}
      </div>
      <div className="@container mt-6">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 @xl:grid-cols-2">
          <ProgramCardBone />
          <ProgramCardBone />
          <ProgramCardBone />
          <ProgramCardBone />
        </div>
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
        ["/app/programs/templates/*/adapt", <AdaptSkeleton key="adapt" />],
        ["/app/programs/templates/*", <TemplateSkeleton key="template" />],
        ["/app/programs/*/edit", <BuilderSkeleton key="edit" />],
        ["/app/programs/*", <ProgramSkeleton key="program" />],
      ]}
    />
  );
}
