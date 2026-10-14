import { Bone, SkeletonMasthead, SkeletonScreen } from "@/components/ui/skeleton";
import { NestedSkeleton } from "@/components/ui/skeleton-client";
import { cn } from "@/lib/utils/cn";
import { MyExercisesSkeleton } from "./exercises/loading";
import { BodySkeleton } from "./body/loading";

/** A section title as the page draws it (SectionHead: 17px semibold, one 24px line). */
function HeadBone({ width }: { width: string }) {
  return (
    <div className="flex h-6 items-center">
      <Bone className={cn("h-4", width)} />
    </div>
  );
}

/** The line under a section title ("Média 4,4 por semana · meta 5"): one 20px line. */
function HeadlineBone({ width }: { width: string }) {
  return (
    <div className="mt-0.5 flex h-5 items-center">
      <Bone className={cn("h-3.5", width)} />
    </div>
  );
}

/**
 * "Treinos por semana" (W-085) as the default 8 weeks draw it, in its card:
 * the bars (h-16) over the seven-day grid (nine columns of cells capped at
 * 14px: 7 × 14 + 6 = 104px), the dates and the legend.
 */
function WeeksSkeleton() {
  return (
    <div className="mt-10">
      <HeadBone width="w-40" />
      <HeadlineBone width="w-52" />
      <div className="card mt-3 p-4 sm:p-5">
        <div className="grid grid-cols-[2.25rem_minmax(0,1fr)]">
          <span />
          <Bone className="h-16" />
          <span />
          <Bone className="mt-1.5 h-[104px]" />
          <span />
          <div className="mt-2 flex h-4 items-center justify-between">
            <Bone className="h-3 w-12" />
            <Bone className="h-3 w-16" />
          </div>
        </div>
        <div className="mt-3 flex h-4 items-center">
          <Bone className="h-3 w-56 max-w-full" />
        </div>
      </div>
    </div>
  );
}

/**
 * "Séries por músculo": the title and its line, the ten groups' rows (36px
 * each: label, track, value) in a card, the caption and the "Volume por músculo" link.
 */
function MusclesSkeleton() {
  return (
    <div className="mt-10">
      <HeadBone width="w-40" />
      <HeadlineBone width="w-56" />
      <div className="card mt-3 flex flex-col px-4 py-2 sm:px-5">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="flex h-9 items-center gap-2.5">
            <div className="w-24 shrink-0">
              <Bone className="h-3.5 w-20" />
            </div>
            <Bone className="h-2.5 min-w-0 flex-1" />
            <div className="flex w-9 shrink-0 justify-end">
              <Bone className="h-3.5 w-6" />
            </div>
            <div className="flex w-14 shrink-0 justify-end">
              <Bone className="h-3 w-11" />
            </div>
          </div>
        ))}
      </div>
      {/* The caption runs 5–6 lines of 13px text on a phone, 3 on a wide screen. */}
      <div className="mt-3 flex flex-col gap-1.5 py-0.5">
        {["w-full", "w-11/12", "w-full", "w-4/5", "w-full", "w-3/5"].map((w, i) => (
          <Bone key={i} className={cn("h-3", w, i >= 3 && "sm:hidden")} />
        ))}
      </div>
      <div className="flex h-11 items-center">
        <Bone className="h-3.5 w-36" />
      </div>
    </div>
  );
}

/** A list card as the page draws it: a title line, then a muted line. */
function RowCard({ trailing = "w-12" }: { trailing?: string }) {
  return (
    <div className="card px-4 py-3.5 sm:px-5">
      <div className="flex h-5 items-center justify-between gap-4">
        <Bone className="h-4 w-2/5" />
        <Bone className={cn("h-3.5", trailing)} />
      </div>
      <div className="mt-1 flex h-5 items-center">
        <Bone className="h-3.5 w-3/5" />
      </div>
    </div>
  );
}

/** "Recordes recentes" (three cards) and "Corpo" (its one card), the last sections. */
function RecordsAndBodySkeleton() {
  return (
    <>
      <div className="mt-10">
        <HeadBone width="w-44" />
        <div className="mt-3 flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <RowCard key={i} />
          ))}
        </div>
      </div>
      <div className="mt-10">
        <HeadBone width="w-20" />
        <div className="card mt-3 flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
          <div className="min-w-0 flex-1">
            {/* "Média 7 dias 81,9 kg · −0,4 kg/sem" wraps to two lines on a phone. */}
            <div className="flex h-11 flex-col justify-around sm:h-6">
              <Bone className="h-4 w-48 max-w-full" />
              <Bone className="h-4 w-28 sm:hidden" />
            </div>
            <div className="mt-1 flex h-5 items-center">
              <Bone className="h-3.5 w-36" />
            </div>
          </div>
          <Bone className="h-5 w-14 shrink-0" />
        </div>
      </div>
    </>
  );
}

/**
 * Progress: title, period chips, the two stat tiles, the program card,
 * "Treinos por semana", the per-exercise list, "Séries por músculo", the
 * records and the Corpo card — the page's order (progress/page.tsx).
 */
function ProgressSkeleton() {
  return (
    <SkeletonScreen label="o seu progresso" className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex items-end justify-between gap-4">
        <SkeletonMasthead kicker="Seus números" title="Progresso" lead={false} />
        <div className="flex h-11 items-center">
          <Bone className="h-3.5 w-20" />
        </div>
      </div>
      {/* The period chips: three to a row on a phone, one row from sm. */}
      <div className="mt-5 grid grid-cols-3 gap-1.5 sm:flex">
        {["sm:w-24", "sm:w-24", "sm:w-20", "sm:w-20", "sm:w-16", "sm:w-14"].map((w, i) => (
          <Bone key={i} className={cn("h-11", w)} />
        ))}
      </div>
      {/* The two tiles: a title that wraps to two lines on a phone, the number, "desde …". */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="card p-4 sm:p-5">
            <div className="flex h-10 flex-col justify-around sm:h-5">
              <Bone className="h-3.5 w-3/4" />
              <Bone className="h-3.5 w-1/3 sm:hidden" />
            </div>
            <div className="mt-1 flex h-8 items-center">
              <Bone className="h-7 w-12" />
            </div>
            <div className="mt-2 flex h-5 items-center">
              <Bone className="h-3.5 w-20" />
            </div>
          </div>
        ))}
      </div>
      <div className="card mt-3 p-4 sm:mt-4 sm:p-5">
        <Bone className="h-3.5 w-24" />
        <Bone className="mt-2 h-4 w-40" />
        <Bone className="mt-4 h-3.5 w-28" />
        <Bone className="mt-2.5 h-1.5 w-full" />
        <Bone className="mt-2 h-3.5 w-48" />
      </div>
      <WeeksSkeleton />
      {/* "Evolução por exercício": title, lead line, a few cards and "Meus exercícios". */}
      <div className="mt-10">
        <HeadBone width="w-48" />
        <HeadlineBone width="w-3/5" />
        <div className="mt-3 flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <RowCard key={i} trailing="w-10" />
          ))}
        </div>
        <div className="mt-2 flex h-11 items-center">
          <Bone className="h-3.5 w-32" />
        </div>
      </div>
      <MusclesSkeleton />
      <RecordsAndBodySkeleton />
    </SkeletonScreen>
  );
}

/** Also the fallback for "Meus exercícios" and "Corpo" below it, until that page's own arrives. */
export default function ProgressLoading() {
  return (
    <NestedSkeleton
      own={<ProgressSkeleton />}
      routes={[
        ["/app/progress/exercises", <MyExercisesSkeleton key="exercises" />],
        ["/app/progress/body", <BodySkeleton key="body" />],
      ]}
    />
  );
}
