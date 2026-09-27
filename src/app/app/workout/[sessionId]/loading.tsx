import { cookies } from "next/headers";
import { Bone, SkeletonScreen } from "@/components/ui/skeleton";
import { NestedSkeleton } from "@/components/ui/skeleton-client";
import { LimitationsBone } from "./limitations-bone";
import { LIMITATIONS_ECHO_COOKIE, echoPx } from "./limitations-echo";
import { SummarySkeleton } from "./summary/loading";

/** The set table's columns (set-table.tsx GRID): Série · kg · reps · RIR · ✓. */
const GRID = "grid grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)_3rem_2.75rem] items-center gap-1.5";

/**
 * The live workout, drawn block by block as workout-execution-client.tsx lays
 * out its first exercise: the sticky header, the "Você informou" note when
 * this device's screen last showed one (LimitationsBone, limitations-echo),
 * the name (two lines, as most are), the exercise nav row, the actions, the
 * program's note, the first-time / last-time box, the warm-up line and then
 * the set table on its real grid. Heights follow the real blocks so the table
 * lands where it will be (within a few px on a phone; a one-line name or a
 * missing note moves it up by that block). Each block wraps one line more on
 * a narrower screen, at the widths the real ones do (measured on the programs'
 * first exercises): the header line below 348px, the prescription below 352px
 * (and again below 338px), the coaching box below 367px, the warm-up line
 * below 382px. Keep in step with the workout layout.
 */
function WorkoutSkeleton({ limitationsPx }: { limitationsPx: number }) {
  return (
    <SkeletonScreen label="o treino" className="flex min-h-dvh flex-col">
      <div className="sticky top-[env(safe-area-inset-top,0px)] z-20 border-b border-border bg-background/95 px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* Day name (text-sm line), then "Exercício 1 de N · 0:00 · ver todos" (a 32px button). */}
            <div className="flex h-5 items-center">
              <Bone className="h-3.5 w-3/5" />
            </div>
            <div className="flex h-8 items-center max-[348px]:h-[38px]">
              <Bone className="h-3 w-4/5" />
            </div>
          </div>
          <Bone className="h-11 w-24 shrink-0" />
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
        <LimitationsBone serverPx={limitationsPx} />
        {/* Exercise name: text-xl, leading-tight, two lines. */}
        <div className="mb-3 flex flex-col gap-[5px] py-0.5">
          <Bone className="h-5 w-11/12" />
          <Bone className="h-5 w-1/2" />
        </div>
        {/* ‹ · photo · sets × reps / rest · › (three lines below 352px, four below 338px) */}
        <div className="flex items-center gap-3 max-[338px]:min-h-19 min-[338px]:max-[352px]:min-h-[58px]">
          <Bone className="size-11 shrink-0" />
          <Bone className="size-14 shrink-0" />
          <div className="min-w-0 flex-1">
            <Bone className="h-4 w-4/5" />
            <Bone className="mt-2 h-3.5 w-1/2" />
            <Bone className="mt-2 hidden h-3.5 w-2/5 max-[338px]:block" />
          </div>
          <Bone className="size-11 shrink-0" />
        </div>
        {/* Ver técnica · Pular exercício · Nota */}
        <div className="mt-3 flex h-11 items-center gap-4">
          <Bone className="h-3.5 w-24" />
          <Bone className="h-3.5 w-28" />
          <Bone className="h-3.5 w-12" />
        </div>
        {/* The program's note (folded to two lines). */}
        <Bone className="mt-3 h-12 w-full" />
        {/* "Primeiro treino" coaching / "Último treino" box. */}
        <Bone className="mt-3 h-17 w-full max-[367px]:h-21" />

        <div className="mt-4">
          {/* Aquecimento · opcional, and its one-line ramp. */}
          <div className="mb-3">
            <div className="flex h-5 items-center justify-between">
              <Bone className="h-3 w-44" />
              <Bone className="h-3.5 w-20" />
            </div>
            <Bone className="mt-[3px] h-3.5 w-4/5" />
            <Bone className="mt-0.5 hidden h-3.5 w-1/4 max-[382px]:block" />
          </div>
          {/* Séries do treino · N */}
          <Bone className="mb-3 h-3 w-36" />
          <div className={`${GRID} px-1 pb-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted`}>
            <span>Série</span>
            <span className="text-center">kg</span>
            <span className="text-center">reps</span>
            <span className="text-center">RIR</span>
            <span className="text-center">✓</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} data-bone-row className={`${GRID} px-1 py-1`}>
                <span className="text-center font-mono text-sm font-bold tabular-nums text-foreground/30">{n}</span>
                <Bone className="h-11" />
                <Bone className="h-11" />
                <Bone className="h-11" />
                <Bone className="size-11" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </SkeletonScreen>
  );
}

/**
 * Also the fallback for the summary below it, until the summary's own
 * arrives. Reads this device's limitations-echo cookie so the skeleton a
 * reload streams keeps the note's room too (a client navigation reads the
 * device's pref instead — LimitationsBone).
 */
export default async function WorkoutLoading() {
  const limitationsPx = echoPx((await cookies()).get(LIMITATIONS_ECHO_COOKIE)?.value);
  return (
    <NestedSkeleton
      own={<WorkoutSkeleton limitationsPx={limitationsPx} />}
      routes={[["/app/workout/*/summary", <SummarySkeleton key="summary" />]]}
    />
  );
}
