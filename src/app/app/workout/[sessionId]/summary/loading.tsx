import { Bone, SkeletonScreen } from "@/components/ui/skeleton";
import { SectionHead } from "@/components/ui/section-head";

/**
 * The post-workout dossier (summary/page.tsx), drawn as it lays out: the
 * left-aligned masthead (saved kicker, "Treino nº · date", the day's title,
 * the stats line), the "Quem vê" row between rules, one panel for the records
 * or the baseline, then the exercise cards. Keep in step with the page.
 */
export function SummarySkeleton() {
  return (
    <SkeletonScreen label="o resumo do treino" className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      {/* TREINO CONCLUÍDO · SALVO NO HISTÓRICO ✓ (two lines below a 366px screen, as the page wraps it) */}
      <div className="flex h-[17px] flex-col justify-around max-[366px]:h-[37px]">
        <Bone className="h-3 w-2/3 max-w-72" />
        <Bone className="hidden h-3 w-1/2 max-[366px]:block" />
      </div>
      {/* Treino nº 1 · 26 set · Semana 1/8 */}
      <div className="mt-3 flex h-[15px] items-center">
        <Bone className="h-2.5 w-1/2 max-w-56" />
      </div>
      {/* The day's name: text-3xl, two lines of 36px on a phone ("Quinta — Puxar (moderado)"), one from sm. */}
      <div className="mt-1.5 flex h-18 flex-col justify-around sm:h-10">
        <Bone className="h-7 w-3/4 sm:w-1/2" />
        <Bone className="h-7 w-1/2 sm:hidden" />
      </div>
      {/* 42 min · 12 séries de trabalho · 3.210 kg de volume */}
      <div className="mt-2 flex h-5 items-center">
        <Bone className="h-3.5 w-3/4" />
      </div>

      {/* Quem vê: label and the three-way switch (stacked in a column under
          21rem, as share-workout-form lays it out), then who that is, between hairlines. */}
      <div className="@container mt-5 border-y border-border py-3">
        <div className="flex flex-col items-stretch gap-1.5 @min-[21rem]:flex-row @min-[21rem]:items-center @min-[21rem]:gap-3">
          <div className="flex h-4 items-center">
            <Bone className="h-2.5 w-16 shrink-0" />
          </div>
          <Bone className="h-10 @min-[21rem]:flex-1" />
        </div>
        <Bone className="mt-3.5 h-3 w-2/5" />
      </div>

      {/* Recordes / Marca inicial: one panel. */}
      <div className="mt-7 border-l-2 border-l-[var(--border-strong)] bg-surface-2 px-3 py-2.5">
        <Bone className="h-3 w-1/2" />
        <Bone className="mt-2 h-3 w-4/5" />
      </div>

      <SectionHead label="Exercícios" className="mt-7" />
      <div className="mt-3 flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="reg-frame p-4">
            <div className="flex items-center gap-3">
              <span className="w-5 shrink-0 font-mono text-xs text-foreground/30">{String(i + 1).padStart(2, "0")}</span>
              <Bone className="h-4 w-1/2" />
            </div>
            <div className="mt-2.5 flex gap-4 pl-8">
              <Bone className="h-3.5 w-16" />
              <Bone className="h-3.5 w-16" />
              <Bone className="h-3.5 w-16" />
            </div>
            <Bone className="ml-8 mt-3.5 h-2.5 w-24" />
            <Bone className="ml-8 mt-1.5 h-3.5 w-2/5" />
          </div>
        ))}
      </div>
    </SkeletonScreen>
  );
}

export default SummarySkeleton;
