import { Bone, BoneRow, SkeletonScreen } from "@/components/ui/skeleton";

/**
 * Today: the masthead (date, greeting, last-workout line, the notifications
 * bell on its right), the next-workout hero where "Iniciar treino" lands,
 * then "Esta semana" with its 7-day strip.
 */
export default function TodayLoading() {
  return (
    <SkeletonScreen label="o treino de hoje" className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Masthead: date line + greeting + "Último treino · …", and the bell */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Bone className="h-3 w-28" />
          <Bone className="mt-3 h-8 w-56 max-w-full sm:h-10" />
          <Bone className="mt-3 h-3 w-64 max-w-full" />
        </div>
        <Bone className="size-11 shrink-0" />
      </div>

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

      {/* Esta semana: count, the 7-day strip, the streak line */}
      <div className="reg-frame mt-6 p-5">
        <Bone className="h-2.5 w-24" />
        <Bone className="mt-3 h-6 w-20" />
        <div className="mt-3 grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <Bone className="h-2.5 w-6" />
              <Bone className="h-8 w-full" />
            </div>
          ))}
        </div>
        <Bone className="mt-3 h-3 w-40" />
      </div>

      <div className="mt-10 flex flex-col gap-3">
        <Bone className="h-3 w-40" />
        <BoneRow />
        <BoneRow />
      </div>
    </SkeletonScreen>
  );
}
