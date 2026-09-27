import { Bone, BoneRow, SkeletonScreen } from "@/components/ui/skeleton";

/** Today: the masthead and the next-workout hero, where "Iniciar treino" lands. */
export default function TodayLoading() {
  return (
    <SkeletonScreen label="o treino de hoje" className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Masthead: date line + greeting */}
      <Bone className="h-3 w-28" />
      <Bone className="mt-3 h-8 w-56 sm:h-10" />

      {/* Hero: the next workout */}
      <div className="panel-raised relative mt-8 border-l-4 border-l-[var(--border-strong)] p-6 sm:p-8">
        <Bone className="h-3 w-32" />
        <Bone className="mt-4 h-8 w-4/5" />
        <Bone className="mt-2 h-8 w-1/2" />
        <Bone className="mt-5 h-4 w-40" />
        <Bone className="mt-6 h-13 w-full" />
        <div className="mt-6 flex flex-col divide-y divide-border border-y border-border">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 py-3">
              <Bone className="size-10 shrink-0" />
              <Bone className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 flex flex-col gap-3">
        <Bone className="h-3 w-40" />
        <BoneRow />
        <BoneRow />
      </div>
    </SkeletonScreen>
  );
}
