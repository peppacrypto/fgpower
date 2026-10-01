import { Fragment } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, CalendarDays, Scale, TrendingUp } from "lucide-react";
import { GArrow, Lettermark } from "@/components/ui/glyph";
import { requireUser } from "@/lib/auth/require-user";
import {
  consistencyOf,
  dateOfDayNumber,
  getExerciseSeries,
  getMuscleWeeks,
  getProgressSummary,
  getWeekRows,
  parsePeriod,
  periodStartDate,
  type ProgressPeriod,
} from "@/lib/data/progress";
import { getBodyweightPoints, getMeasurements } from "@/lib/data/body-metrics";
import { getBlockProgress } from "@/lib/data/program-lifecycle";
import { prisma } from "@/lib/db";
import { BlockProgressMeter } from "@/components/programs/block-progress-meter";
import {
  byGain,
  comparable,
  compareSessions,
  describePr,
  muscleVolume,
  progressMode,
  weekColumns,
  type WeekColumns,
} from "@/lib/data/progress-core";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { Sparkline } from "@/components/charts/sparkline";
import { EmptyChartPreview } from "@/components/charts/empty-chart";
import { formatValue, monoDate } from "@/components/charts/scale";
import { WeeklyTrainingChart } from "@/components/charts/weekly-training-chart";
import { MuscleVolumeBars } from "@/components/charts/muscle-volume-bars";
import { dayNumberOf, mondayOf } from "@/lib/training/day-rotation";
import {
  bodyKind,
  formatBodyValue,
  formatRate,
  movingAverage7,
  weeklyRate,
  type WeeklyRate,
} from "@/lib/training/body-weight";
import { formatNumber, plural } from "@/lib/utils/format";
import { isTimedHold } from "@/lib/training/set-plan";
import { cn } from "@/lib/utils/cn";
import { PERIODS, PeriodChips } from "./period-chips";

export const metadata: Metadata = { title: "Progresso" };

/** Exercises shown under "Evolução por exercício"; the rest are one tap away in "Meus exercícios". */
const TOP_EXERCISES = 6;
/** "Tudo" reads the muscles back as far as the streak's weeks go (400 days). */
const ALL_LOOKBACK_MS = 400 * 86_400_000;

const NBSP = " ";

/**
 * Corpo's card in words: its lines ("Média 7 dias 81,9 kg · −0,4 kg/sem", or
 * the last weigh-in; up to 3 measurements) and the link's name, which says
 * the same words (label in name) — never a bare "abrir" over the numbers.
 */
function bodyCardText(p: { avg: number | null; rate: WeeklyRate | null; lastKg: number | null; measures: string[] }) {
  const avg = p.avg != null ? formatBodyValue(p.avg, "kg") : null;
  const rate = avg != null && p.rate ? formatRate(p.rate, { percent: false }) : null;
  const last = avg == null && p.lastKg != null ? formatBodyValue(p.lastKg, "kg") : null;
  const measures = p.measures.join(" · ");
  const headline =
    avg != null ? `Média 7 dias ${avg}${rate ? ` · ${rate}` : ""}` : last != null ? `Última pesagem ${last}` : "Peso e medidas";
  return { avg, rate, last, measures, name: measures ? `${headline}; ${measures}` : headline };
}

/** "Treinos por semana" in words, for its headline and its image's label. */
function weeksText(w: WeekColumns, since: string) {
  const current = w.columns[w.columns.length - 1];
  const thisWeek = current ? `esta semana ${current.done} de ${current.target}` : "";
  if (w.avgDone == null) return { headline: `esta semana: ${current?.done ?? 0} de ${current?.target ?? 0}`, aria: `Treinos por semana: ${thisWeek}.` };
  return {
    headline: `média ${w.avgDone} por semana · meta ${w.targetText}`,
    aria: `Treinos por semana desde ${since}: média ${w.avgDone} por semana, meta ${w.targetText}; ${w.metWeeks} de ${plural(w.completeWeeks, "semana completa", "semanas completas")} na meta; ${thisWeek}.`,
  };
}

export default async function ProgressPage({ searchParams }: PageProps<"/app/progress">) {
  const sp = await searchParams;
  const period: ProgressPeriod = parsePeriod(sp.period, "8w");
  const user = await requireUser();

  const now = new Date();
  // One span for every number below: the Monday opening the period's weeks (periodStartDate).
  const start = periodStartDate(period, now);
  const startDay = start ? dayNumberOf(start) : null;
  const [summary, series, weekRows, muscleRows, weighIns, measurements] = await Promise.all([
    getProgressSummary(user.id, period, now),
    getExerciseSeries(user.id, { since: start, recent: 12 }),
    // The weekly streak's own weeks: "semanas na meta" counts like Today.
    getWeekRows(user.id, now),
    getMuscleWeeks(user.id, start ?? new Date(now.getTime() - ALL_LOOKBACK_MS)),
    // Corpo's card: the period's weigh-ins (six days before it for the first average) and measurements.
    getBodyweightPoints(user.id, startDay != null ? startDay - 6 : null),
    getMeasurements(user.id, null),
  ]);
  const consistency = consistencyOf(weekRows, period);
  // Trends (W-085): the period's weeks, and the sets per muscle in them.
  const weeks = weekColumns(weekRows, period);
  const volume = muscleVolume(muscleRows, weeks.columns);
  const todayNo = dayNumberOf(now);
  const weeksWords = weeksText(weeks, weeks.columns[0] ? monoDate(dateOfDayNumber(weeks.columns[0].monday)) : "");
  const averaged = movingAverage7(weighIns).filter((p) => startDay == null || p.day >= startDay);
  const averages = averaged.flatMap((p) => (p.avg != null ? [p.avg] : []));
  const bodyRate = weeklyRate(averaged);
  const latestMeasurements = [...measurements].sort((a, b) => b.latest.day - a.latest.day).slice(0, 3);
  const hasBody = weighIns.length > 0 || measurements.length > 0;
  const bodyCard = bodyCardText({
    avg: averages.length > 0 ? averages[averages.length - 1] : null,
    rate: bodyRate,
    lastKg: weighIns.length > 0 ? weighIns[weighIns.length - 1].value : null,
    measures: latestMeasurements.map((m) => `${bodyKind(m.kind)?.label ?? ""} ${formatBodyValue(m.latest.value, "cm")}`),
  });
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

      {consistency.state !== "not-started" && weeks.columns.length > 0 ? (
        <section id="semanas" className="mt-8" aria-labelledby="semanas-titulo">
          <h2 id="semanas-titulo" className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
            <CalendarDays className="size-4" aria-hidden />
            Treinos por semana
          </h2>
          <p className="mb-3 font-mono text-[12px] font-semibold tabular-nums" data-weeks-headline>
            {weeksWords.headline}
          </p>
          <WeeklyTrainingChart columns={weeks.columns} todayOffset={todayNo - mondayOf(todayNo)} summary={weeksWords.aria} />
        </section>
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

      {consistency.state !== "not-started" ? (
        <section id="musculos" className="mt-8" aria-labelledby="musculos-titulo">
          <h2 id="musculos-titulo" className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
            <BarChart3 className="size-4" aria-hidden />
            Séries por músculo
          </h2>
          {volume.basis ? (
            <>
              <p className="mb-3 font-mono text-[12px] font-semibold" data-muscles-headline>
                {volume.basis === "parcial"
                  ? "esta semana, parcial"
                  : `média por semana treinada · ${plural(volume.basis.weeks, "semana", "semanas")}`}
              </p>
              <MuscleVolumeBars rows={volume.rows} />
              <p className="mt-3 text-xs text-muted">
                Séries de trabalho concluídas; as de apoio contam metade. Semanas de deload ficam de fora. A faixa de 10–20 é
                uma referência para hipertrofia, não uma meta — programas com prioridades deixam alguns músculos abaixo de
                propósito. Ombros somam deltoide anterior, lateral e posterior.
              </p>
              <Link
                href="/app/science/training-volume"
                className="mt-1 inline-flex min-h-11 items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-accent hover:underline"
              >
                Volume por músculo
                <GArrow className="size-3" />
              </Link>
            </>
          ) : (
            <p className="text-sm text-muted">Nenhuma semana treinada {periodSpan}.</p>
          )}
        </section>
      ) : null}

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

      {/* Body data (W-083): the user's alone — a way into Corpo. */}
      <section className="mt-8" aria-labelledby="corpo">
        <h2 id="corpo" className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
          <Scale className="size-4" aria-hidden />
          Corpo
        </h2>
        {hasBody ? (
          <Link href="/app/progress/body" aria-label={`Corpo: ${bodyCard.name} — abrir`} data-body-card>
            <Card className="is-link">
              <CardContent className="py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    {bodyCard.avg != null ? (
                      <p className="font-mono text-sm font-semibold tabular-nums">
                        <span className="text-muted">Média 7 dias </span>
                        {/* The rate may take its own line (320px), never run under the sparkline;
                            the separator stays at the end of the first line, never opens the second. */}
                        <span className="whitespace-nowrap">
                          {bodyCard.avg}
                          {bodyCard.rate ? <span className="text-muted">{`${NBSP}·`}</span> : null}
                        </span>
                        {bodyCard.rate ? (
                          <>
                            {" "}
                            <span className="whitespace-nowrap text-muted">{bodyCard.rate}</span>
                          </>
                        ) : null}
                      </p>
                    ) : bodyCard.last != null ? (
                      <p className="font-mono text-sm font-semibold tabular-nums">
                        <span className="text-muted">Última pesagem </span>
                        {bodyCard.last}
                      </p>
                    ) : (
                      <p className="text-sm font-medium">Peso e medidas</p>
                    )}
                    {bodyCard.measures ? (
                      <p className="mt-1 truncate font-mono text-[11px] tabular-nums text-muted">{bodyCard.measures}</p>
                    ) : null}
                  </div>
                  {averages.length > 1 ? (
                    <Sparkline
                      values={averages}
                      width={56}
                      height={20}
                      label={`Média de 7 dias: de ${formatNumber(averages[0], 1)} para ${formatNumber(averages[averages.length - 1], 1)} kg`}
                    />
                  ) : (
                    <GArrow className="size-3 shrink-0 text-muted" />
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ) : (
          <Link
            href="/app/progress/body"
            className="reg-frame is-link flex min-h-11 items-center justify-between gap-3 px-4 py-3 text-sm font-medium"
            data-body-card="empty"
          >
            Registrar peso e medidas
            <GArrow className="size-3 shrink-0" />
          </Link>
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
