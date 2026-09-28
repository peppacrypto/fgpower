import Link from "next/link";
import { GArrow } from "@/components/ui/glyph";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { InlineActionForm } from "@/components/workout/inline-action-form";
import { repeatBlock, startNextBlock } from "@/lib/actions/programs";
import type { CompletedBlock } from "@/lib/data/program-lifecycle";
import { formatKg, formatNumber, plural, pluralWord } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

const FIELD = "font-mono text-[10px] font-bold uppercase tracking-[0.16em]";

/**
 * "BLOCO CONCLUÍDO · GD 1": the end of a block, as the dossier records it —
 * workouts done of the planned, weeks, records, the main lifts' estimated 1RM
 * from the first week to the last — and what comes next: "Começar GD 2" (the
 * series' next block) with "Repetir bloco" beside it, or, outside the series
 * (and after GD 8), "Repetir bloco" and the recommended programs. Shared by
 * the workout summary and Today (data: program-lifecycle getRecentlyCompletedBlock).
 */
export function BlockDonePanel({
  block,
  className,
  headingLevel = 2,
}: {
  block: CompletedBlock;
  className?: string;
  headingLevel?: 1 | 2;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const planned = block.plannedSessions;
  const lastOfSeries = block.series !== null && block.next === null;
  return (
    <section
      aria-labelledby="block-done-title"
      data-testid="block-done"
      className={cn("relative overflow-hidden panel-raised", className)}
    >
      <span className="absolute left-0 top-0 h-full w-1.5 bg-accent-strong" aria-hidden />
      <div className="p-5 pl-6 sm:p-7 sm:pl-8">
        <p className={cn(FIELD, "flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-accent")}>
          <span>{lastOfSeries ? "Plano GD concluído" : "Bloco concluído"}</span>
          {block.series ? (
            <>
              <span aria-hidden>·</span>
              <span>
                Bloco {block.series.index} de {block.series.total}
              </span>
            </>
          ) : null}
        </p>
        <Heading id="block-done-title" className="text-display mt-1.5 text-2xl font-extrabold leading-tight sm:text-3xl">
          {block.programName}
        </Heading>

        <dl className="mt-4 grid grid-cols-3 divide-x divide-border border-y border-border py-3 text-center">
          <Stat
            value={planned ? `${formatNumber(block.sessionsDone, 0)}/${formatNumber(planned, 0)}` : formatNumber(block.sessionsDone, 0)}
            label={pluralWord(planned ?? block.sessionsDone, "treino", "treinos")}
          />
          <Stat value={formatNumber(block.weeks, 0)} label={pluralWord(block.weeks, "semana", "semanas")} />
          <Stat value={formatNumber(block.prCount, 0)} label={block.prCount === 1 ? "exercício com PR" : "exercícios com PR"} />
        </dl>

        {block.anchorProgress && block.anchorProgress.length > 0 ? (
          <div className="mt-4">
            <p className={cn(FIELD, "text-muted")}>1RM estimado · 1ª → última semana</p>
            <ul className="mt-1.5 flex flex-col gap-1">
              {block.anchorProgress.map((a) => (
                <li key={a.slug} className="flex items-baseline justify-between gap-3 text-sm">
                  <Link href={`/app/exercises/${a.slug}/history`} className="min-w-0 truncate hover:text-accent">
                    {a.exerciseName}
                  </Link>
                  <span
                    className={cn(
                      "shrink-0 whitespace-nowrap font-mono text-xs font-bold tabular-nums",
                      a.toKg > a.fromKg ? "text-success" : "text-muted",
                    )}
                  >
                    {formatKg(a.fromKg)} → {formatKg(a.toKg)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-start gap-2">
          {block.next ? (
            <InlineActionForm
              action={startNextBlock.bind(null, block.enrollmentId)}
              failText="Não foi possível ativar. Tente de novo."
              className="flex w-full flex-col sm:w-auto"
              errorClassName="mt-1.5"
            >
              <SubmitButton
                size="lg"
                variant="strong"
                pendingLabel="Ativando…"
                className="h-auto min-h-13 w-full flex-col items-start gap-0.5 whitespace-normal py-2.5 text-left sm:w-auto"
              >
                <span>Começar {block.next.name}</span>
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] opacity-75">
                  Bloco {block.next.index} de {block.next.total}
                </span>
              </SubmitButton>
            </InlineActionForm>
          ) : null}
          <InlineActionForm
            action={repeatBlock.bind(null, block.enrollmentId)}
            failText="Não foi possível reiniciar. Tente de novo."
            className="flex w-full flex-col sm:w-auto"
            errorClassName="mt-1.5"
          >
            <SubmitButton
              size="lg"
              variant={block.next ? "ghost" : "strong"}
              pendingLabel="Reiniciando…"
              className="w-full sm:w-auto"
            >
              {/* A GD block is repeated as a block (Today's hero says the same). */}
              {block.series ? "Repetir bloco" : "Repetir"}
            </SubmitButton>
          </InlineActionForm>
          {block.next ? null : (
            // Full width on a phone, wrapping inside itself: at 320–360px it never runs past the panel.
            <Button
              size="lg"
              variant="outline"
              className="h-auto min-h-13 w-full whitespace-normal px-4 py-2.5 text-center sm:w-auto"
              asChild
            >
              <Link href="/app/programs">
                Ver programas recomendados
                <GArrow className="size-4" />
              </Link>
            </Button>
          )}
        </div>
        <p className="mt-3 text-xs text-muted">
          {/* Every finished workout of the block — redos, the entry week and a late one included — as the history holds them. */}
          {plural(block.savedWorkouts, "treino fica", "treinos ficam")} no histórico
          {block.next ? `; o ${block.next.name} começa na semana 1.` : "."}
        </p>
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center px-1.5">
      <dt className="mt-1 text-[9px] uppercase leading-tight tracking-wider text-muted">{label}</dt>
      <dd className="order-first font-mono text-lg font-bold tabular-nums leading-none">{value}</dd>
    </div>
  );
}
