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
          <Bone className="h-3.5 w-24" />
          <Bone className="mt-2.5 h-8 w-56 max-w-full" />
          <Bone className="mt-3 h-3.5 w-64 max-w-full" />
        </div>
        <Bone className="size-11 shrink-0" />
      </div>

      {/* Hero: the next workout */}
      <div className="panel mt-6 p-5 sm:p-7">
        <Bone className="h-3.5 w-28" />
        <Bone className="mt-3 h-9 w-3/4" />
        <Bone className="mt-3 h-4 w-40" />
        <Bone className="mt-5 h-12 w-full sm:w-56" />
        <div className="mt-6 flex flex-col divide-y divide-border border-t border-border">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 py-2.5">
              <Bone className="size-11 shrink-0" />
              <Bone className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>

      {/* Esta semana: count, the 7-day strip, the streak line; the program beside it from sm */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-4 sm:p-5">
          <Bone className="h-4 w-24" />
          <Bone className="mt-2.5 h-7 w-28" />
          <div className="mt-4 grid grid-cols-7 gap-1.5">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <Bone className="h-3 w-6" />
                <Bone className="h-9 w-full" />
              </div>
            ))}
          </div>
          <Bone className="mt-4 h-3.5 w-40" />
        </div>
        <div className="card hidden p-4 sm:p-5 lg:block">
          <Bone className="h-3.5 w-20" />
          <Bone className="mt-2 h-5 w-48 max-w-full" />
          <Bone className="mt-4 h-3.5 w-40" />
          <Bone className="mt-3 h-1.5 w-full" />
          <Bone className="mt-3 h-3.5 w-28" />
        </div>
      </div>

      <div className="mt-10 flex flex-col gap-2">
        <Bone className="mb-1 h-4 w-44" />
        <BoneRow />
        <BoneRow />
      </div>
    </SkeletonScreen>
  );
}
