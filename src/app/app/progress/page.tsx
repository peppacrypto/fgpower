import { Fragment } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { GArrow, Lettermark } from "@/components/ui/glyph";
import { requireUser } from "@/lib/auth/require-user";
import {
  consistencyOf,
  getExerciseSeries,
  getProgressSummary,
  getWeekRows,
  parsePeriod,
  periodStartDate,
  type ProgressPeriod,
} from "@/lib/data/progress";
import { getBlockProgress } from "@/lib/data/program-lifecycle";
import { prisma } from "@/lib/db";
import { BlockProgressMeter } from "@/components/programs/block-progress-meter";
import { byGain, comparable, compareSessions, describePr, progressMode } from "@/lib/data/progress-core";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { Sparkline } from "@/components/charts/sparkline";
import { EmptyChartPreview } from "@/components/charts/empty-chart";
import { formatValue, monoDate } from "@/components/charts/scale";
import { isTimedHold } from "@/lib/training/set-plan";
import { cn } from "@/lib/utils/cn";
import { PERIODS, PeriodChips } from "./period-chips";

export const metadata: Metadata = { title: "Progresso" };

/** Exercises shown under "Evolução por exercício"; the rest are one tap away in "Meus exercícios". */
const TOP_EXERCISES = 6;

export default async function ProgressPage({ searchParams }: PageProps<"/app/progress">) {
  const sp = await searchParams;
  const period: ProgressPeriod = parsePeriod(sp.period, "8w");
  const user = await requireUser();

  const now = new Date();
  // One span for every number below: the Monday opening the period's weeks (periodStartDate).
  const start = periodStartDate(period, now);
  const [summary, series, weekRows] = await Promise.all([
    getProgressSummary(user.id, period, now),
    getExerciseSeries(user.id, { since: start, recent: 12 }),
    // The weekly streak's own weeks: "semanas na meta" counts like Today.
    getWeekRows(user.id, now),
  ]);
  const consistency = consistencyOf(weekRows, period);
  // "desde 27 JUL" under both tiles: the same weeks (never before the first workout's week).
  // "Tudo" counts every workout, so its tile dates its own first week — the
  // same Monday as the weeks on target unless the history is older than
  // their 400 days (then each tile says where it starts).
  const workoutsSince =
    period === "all" ? summary.countedSince : consistency.state !== "not-started" ? (consistency.since ?? start) : null;
  const enrollment = summary.activeEnrollment;
  // "Sem. 3/13 · 18 de 65 treinos" — the program lifecycle's own count
  // (lib/data/program-lifecycle), the same the programs page shows.
  const block = enrollment
    ? await getBlockProgress(prisma, user.id, {
        id: enrollment.id,
        currentWeek: enrollment.currentWeek,
        startedAt: enrollment.startedAt,
        program: {
          durationWeeks: enrollment.program.durationWeeks,
          daysPerWeek: enrollment.program.daysPerWeek,
          dayCount: enrollment.program._count.days,
        },
      })
    : null;

  // Every exercise done twice or more in the period, by its fairest number
  // (lib/data/progress-core): gains first, then maintenance, then drops.
  const evolution = series
    .flatMap((s) => {
      const mode = progressMode(s.recent, s);
      const points = comparable([s.first, ...s.recent.filter((p) => p.sessionId !== s.first.sessionId)], mode);
      if (points.length < 2) return [];
      const comparison = compareSessions(points[0], points[points.length - 1], mode);
      if (!comparison) return [];
      const trend = s.recent.map(comparison.valueOf).filter((v): v is number => v != null);
      return [{ ...s, mode, comparison, trend }];
    })
    .sort(byGain);
  const periodSpan = PERIODS.find((p) => p.value === period)?.span ?? "";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Progresso</h1>
        {/* Every past workout, by date and on the calendar. */}
        <Link
          href="/app/history"
          className="-my-2 inline-flex min-h-11 items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-accent hover:underline"
        >
          Histórico
          <GArrow className="size-3" />
        </Link>
      </div>

      <PeriodChips period={period} basePath="/app/progress" className="mt-4" />

      {/* Two tiles as one table: each one's title, number and "desde" are a row
          (subgrid), so the numbers and the "desde" lines sit level side by side
          even when only one title wraps. */}
      <div className="mt-6 grid grid-cols-2 gap-x-3">
        <Link
          href="/app/history"
          aria-label={`Treinos concluídos: ${summary.sessionCount}${workoutsSince ? ` desde ${monoDate(workoutsSince).toLowerCase()}` : ""} — ver histórico`}
          className="row-span-3 grid grid-rows-subgrid"
        >
          <Card className="is-link row-span-3 grid grid-rows-subgrid">
            <CardContent className="row-span-3 grid grid-rows-subgrid pt-5">
              <p className="flex items-start justify-between gap-2 text-xs font-medium text-muted">
                Treinos concluídos
                <GArrow className="mt-0.5 size-3 shrink-0" />
              </p>
              <p className="mt-1 font-mono text-2xl font-bold tabular-nums">{summary.sessionCount}</p>
              {workoutsSince ? (
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">desde {monoDate(workoutsSince)}</p>
              ) : null}
            </CardContent>
          </Card>
        </Link>
        <Card data-consistency={consistency.state} className="row-span-3 grid grid-rows-subgrid">
          <CardContent className="row-span-3 grid grid-rows-subgrid pt-5">
            <p className="text-xs font-medium text-muted">Semanas na meta</p>
            {consistency.state === "ratio" ? (
              <>
                <p className="mt-1 font-mono text-2xl font-bold tabular-nums">
                  {consistency.met}
                  <span className="text-base text-muted">/{consistency.total}</span>
                </p>
                {consistency.since ? (
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">
                    desde {monoDate(consistency.since)}
                  </p>
                ) : null}
              </>
            ) : consistency.state === "early" ? (
              <>
                <p className="mt-1.5 text-base font-bold">{consistency.week === 1 ? "Primeira semana" : "Segunda semana"}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-muted">
                  {consistency.week === 1 ? "A conta começa após 2 semanas completas." : "A conta começa na próxima semana."}
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-muted">—</p>
                <p className="mt-0.5 text-[11px] leading-snug text-muted">Começa no seu primeiro treino.</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {enrollment && block ? (
        <Link
          href={`/app/programs/${enrollment.programId}`}
          aria-label={`Programa atual: ${enrollment.program.name} — ver programa`}
          className="mt-3 block"
        >
          <Card className="is-link" data-program-progress>
            <CardContent className="py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted">Programa atual</p>
                  <p className="truncate font-semibold">{enrollment.program.name}</p>
                </div>
                <GArrow className="mt-1 size-3 shrink-0 text-muted" />
              </div>
              {/* No adherence here: it counts only the weeks trained, so next to
                  "semanas na meta" a skipped week would still read "100%". */}
              <BlockProgressMeter progress={{ ...block, adherencePct: null }} className="mt-3" />
            </CardContent>
          </Card>
        </Link>
      ) : null}

      <section className="mt-8" aria-labelledby="evolucao">
        <h2 id="evolucao" className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
          <TrendingUp className="size-4" />
          Evolução por exercício
        </h2>
        {evolution.length === 0 ? (
          <EmptyState
            icon={<EmptyChartPreview />}
            title="Sua evolução aparece aqui"
            description="Depois de 2 treinos do mesmo exercício, a comparação entre eles aparece aqui — carga, repetições ou tempo."
            action={
              <Button variant="strong" asChild className="mt-1">
                <Link href={enrollment ? "/app/today" : "/app/programs"}>
                  {enrollment ? "Ver próximo treino" : "Escolher um programa"}
                </Link>
              </Button>
            }
          />
        ) : (
          <>
            <p className="-mt-1 mb-3 text-xs text-muted">
              Primeira × última sessão de cada exercício {periodSpan}.
            </p>
            <div className="flex flex-col gap-2">
              {evolution.slice(0, TOP_EXERCISES).map((e) => (
                <Link key={e.slug} href={`/app/exercises/${e.slug}/history?period=${period}`}>
                  <Card className="is-link">
                    <CardContent className="py-3.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="min-w-0 flex-1 text-sm font-medium">{e.namePt}</p>
                        <span
                          data-direction={e.comparison.direction}
                          className={cn(
                            "shrink-0 font-mono tabular-nums",
                            e.comparison.direction === "up"
                              ? "text-sm font-semibold text-success"
                              : e.comparison.direction === "down"
                                ? "text-sm font-semibold text-muted"
                                : "text-[10px] font-semibold uppercase tracking-wider text-muted",
                          )}
                        >
                          {e.comparison.pctText}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-3">
                        <p className="min-w-0 font-mono text-[11px] tabular-nums text-muted">
                          <Arrowed text={e.comparison.detail} />
                        </p>
                        {e.trend.length > 1 ? (
                          <Sparkline
                            values={e.trend}
                            width={56}
                            height={20}
                            label={`Últimas ${e.trend.length} sessões: de ${trendValue(e.trend[0], e.comparison.metric)} para ${trendValue(e.trend[e.trend.length - 1], e.comparison.metric)}`}
                          />
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </>
        )}
        {series.length > 0 || consistency.state !== "not-started" ? (
          <Link
            href="/app/progress/exercises"
            className="mt-3 inline-flex min-h-11 items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-accent hover:underline"
          >
            Meus exercícios
            <GArrow className="size-3" />
          </Link>
        ) : null}
      </section>

      <section className="mt-8" aria-labelledby="recordes">
        <h2 id="recordes" className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
          <Lettermark code="PR" className="size-5 text-[9px]" />
          Recordes recentes
        </h2>
        {summary.recentPrs.length === 0 ? (
          <EmptyState
            title="Nenhum recorde neste período"
            description="Um recorde aparece quando você supera uma marca sua — a primeira sessão de cada exercício vira a marca inicial."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {summary.recentPrs.map((pr) => {
              const timed = isTimedHold({ slug: pr.slug });
              const records = pr.records.flatMap((r) => {
                const d = describePr(r, timed);
                return d ? [d] : [];
              });
              return (
                <Link key={pr.exerciseId} href={`/app/exercises/${pr.slug}/history`}>
                  <Card className="is-link">
                    <CardContent className="py-3.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 flex-1 text-sm font-medium">{pr.namePt}</span>
                        <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted">
                          {monoDate(pr.achievedAt)}
                        </span>
                      </div>
                      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                        {records.map((r) => (
                          <span key={r.label} className="whitespace-nowrap">
                            <span className="text-muted">{r.label}</span>{" "}
                            <span className="font-mono font-semibold tabular-nums">{r.value}</span>
                          </span>
                        ))}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

/** "60 kg × 8 → 65 kg × 6" that wraps only at the arrow, never inside a set. */
function Arrowed({ text }: { text: string }) {
  const parts = text.split(" → ");
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 ? " " : null}
          <span className="whitespace-nowrap">
            {i > 0 ? "→ " : ""}
            {part}
          </span>
        </Fragment>
      ))}
    </>
  );
}

/** A sparkline end value in words, for its label. */
function trendValue(v: number, metric: string) {
  if (metric === "reps" || metric === "reps-at-load") return formatValue(v, "reps");
  if (metric === "time" || metric === "time-at-load") return formatValue(v, "seconds");
  return formatValue(v, "kg");
}
