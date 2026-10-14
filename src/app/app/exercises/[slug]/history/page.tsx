import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronDown, ChevronLeft } from "lucide-react";
import { GArrow, Lettermark } from "@/components/ui/glyph";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { getExerciseHistory, getExercisePersonalRecords } from "@/lib/data/history";
import { parsePeriod, periodStartDate } from "@/lib/data/progress";
import { bestSetText, describePr, progressMode, type SessionPerf } from "@/lib/data/progress-core";
import { formatAppDate } from "@/lib/training/week";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { SectionHead } from "@/components/ui/section-head";
import { ProgressChart } from "@/components/charts/progress-chart";
import { shortDate, type ChartInputPoint, type ChartUnit } from "@/components/charts/scale";
import { formatNumber, formatKg, formatVolume, plural } from "@/lib/utils/format";
import { formatSet, isBodyweightEquipment, isTimedHold } from "@/lib/training/set-plan";
import { NOT_FOUND_TITLE } from "@/components/ui/not-found-panel";
import { PERIODS, PeriodChips } from "@/app/app/progress/period-chips";

export async function generateMetadata({ params }: PageProps<"/app/exercises/[slug]/history">): Promise<Metadata> {
  const { slug } = await params;
  const ex = await prisma.exercise.findUnique({ where: { slug }, select: { namePt: true } });
  return ex ? { title: `Histórico · ${ex.namePt}` } : { title: NOT_FOUND_TITLE };
}

/** Sessions listed before "Ver todas". */
const LIST_SIZE = 12;

/** A-075 · back to the workout the history was opened from: `/app/workout/<id>`, nothing else (no open redirect). */
const WORKOUT_RETURN = /^\/app\/workout\/[\w-]+(\?ex=[\w-]+)?$/;

type Chart = { label: string; unit: ChartUnit; points: ChartInputPoint[] } | { note: string };

export default async function ExerciseHistoryPage({
  params,
  searchParams,
}: PageProps<"/app/exercises/[slug]/history">) {
  const { slug } = await params;
  const sp = await searchParams;
  const from = Array.isArray(sp.from) ? sp.from[0] : sp.from;
  const backToWorkout = typeof from === "string" && WORKOUT_RETURN.test(from) ? from : null;
  const period = parsePeriod(sp.period, "all");
  const listAll = sp.sessoes === "todas";
  const user = await requireUser();
  const exercise = await prisma.exercise.findUnique({
    where: { slug },
    select: { id: true, namePt: true, equipment: { select: { category: true } } },
  });
  if (!exercise) notFound();

  const [history, prs, profile] = await Promise.all([
    getExerciseHistory(user.id, exercise.id),
    getExercisePersonalRecords(user.id, exercise.id),
    prisma.profile.findUnique({ where: { userId: user.id }, select: { loadIncrementKg: true } }),
  ]);

  const backLink = backToWorkout ? (
    <Link
      href={backToWorkout}
      className="-mt-2 -ml-1 mb-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted hover:text-foreground"
    >
      <ChevronLeft className="size-4" aria-hidden />
      Voltar ao treino
    </Link>
  ) : null;

  if (history.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        {backLink}
        <span className="eyebrow">Meu histórico</span>
        <h1 className="text-display mt-0.5 text-[1.75rem] font-semibold leading-tight [overflow-wrap:anywhere] sm:text-[2rem]">
          {exercise.namePt}
        </h1>
        <div className="mt-8">
          <EmptyState
            icon={<Lettermark code="PR" className="size-8 text-[11px]" />}
            title="Sem histórico ainda"
            description="Assim que você concluir séries deste exercício em um treino, a evolução aparece aqui."
            action={
              <Link
                href={`/app/exercises/${slug}`}
                className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-accent hover:underline"
              >
                Ver o exercício
                <GArrow className="size-3.5" />
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  // A hold's "reps" are seconds; an exercise never loaded (bodyweight) is
  // followed by its reps (or seconds) instead of a flat 0 kg.
  const timed = isTimedHold({ slug });
  const mode = progressMode(history, { bodyweight: isBodyweightEquipment(exercise.equipment?.category), timed });
  const loadStep = profile?.loadIncrementKg && profile.loadIncrementKg > 0 ? profile.loadIncrementKg : 2.5;
  const count = (n: number) => (timed ? `${formatNumber(n, 0)} s` : plural(n, "rep", "reps"));

  // Which sessions set a record, per kind: their chart points get a dot.
  const recordSessions = (kind: string) => new Set(prs.filter((r) => r.kind === kind).map((r) => r.sessionId));
  const weightRecords = recordSessions("MAX_WEIGHT");
  const e1rmRecords = recordSessions("ESTIMATED_1RM");
  const repRecords = recordSessions("MAX_REPS_AT_WEIGHT");
  const anyRecord = new Set(prs.map((r) => r.sessionId));

  // ----- Best marks: all-time, each with the day it was set.
  const top = <T,>(pick: (p: SessionPerf) => T | null, better: (a: T, b: T) => boolean) =>
    history.reduce<{ p: SessionPerf; v: T } | null>((best, p) => {
      const v = pick(p);
      return v != null && (!best || better(v, best.v)) ? { p, v } : best;
    }, null);
  const heaviest = top(
    (p) => (p.topKg > 0 ? p : null),
    (a, b) => a.topKg > b.topKg || (a.topKg === b.topKg && a.topReps > b.topReps),
  );
  const mostReps = top((p) => p.bestReps, (a, b) => a > b);
  const best1Rm = top((p) => p.e1rmKg, (a, b) => a > b);
  const bestVolume = top((p) => (p.volumeKg > 0 ? p.volumeKg : null), (a, b) => a > b);
  const repRecord = prs.find((pr) => pr.kind === "MAX_REPS_AT_WEIGHT");
  const loadMode = mode === "load" || mode === "loaded-time";
  const bestMarks = [
    loadMode && heaviest
      ? { label: "Maior carga", value: formatSet(heaviest.p.topKg, heaviest.p.topReps, { timed }), date: heaviest.p.date }
      : !loadMode && mostReps
        ? { label: timed ? "Maior tempo" : "Mais repetições", value: count(mostReps.v), date: mostReps.p.date }
        : null,
    // A hold's seconds give no 1RM, and kg × seconds is no volume.
    mode === "load" && best1Rm ? { label: "Melhor 1RM est.", value: formatKg(best1Rm.v), date: best1Rm.p.date } : null,
    mode === "load" && bestVolume ? { label: "Maior volume", value: formatVolume(bestVolume.v), date: bestVolume.p.date } : null,
  ].filter((m) => m !== null);
  const lastRepMark =
    repRecord?.reps != null
      ? {
          label: timed ? "Último recorde de tempo" : "Último recorde de reps",
          value: repRecord.weightKg ? formatSet(repRecord.weightKg, repRecord.reps, { timed }) : count(repRecord.reps),
          date: repRecord.achievedAt,
        }
      : null;
  // The latest rep (or time) record gets its own tile only when it is a
  // different set ("40 kg × 11" beside "Maior carga 45 kg × 6"). The same set
  // is never shown twice: without a load it is the best mark itself ("14
  // reps"), so it goes; with one (double progression: same top load, +1 rep)
  // the heaviest tile notes it instead.
  const repeated = lastRepMark != null ? bestMarks.find((m) => m.value === lastRepMark.value) : undefined;
  const marks: { label: string; value: string; date: Date; note?: string }[] =
    lastRepMark && !repeated
      ? [...bestMarks, lastRepMark]
      : bestMarks.map((m) =>
          m === repeated && loadMode ? { ...m, note: `Também seu ${lastRepMark!.label.toLowerCase()}` } : m,
        );

  // ----- The period's sessions: charts and list.
  const start = periodStartDate(period);
  const inPeriod = start ? history.filter((p) => p.date.getTime() >= start.getTime()) : history;
  const point = (p: SessionPerf, value: number | null, records: Set<string | null>, detail?: string): ChartInputPoint => ({
    key: p.sessionId,
    date: p.date,
    value,
    record: records.has(p.sessionId),
    detail,
  });
  const none = new Set<string | null>();
  const charts: Chart[] =
    mode === "load"
      ? [
          {
            label: "Melhor carga por sessão",
            unit: "kg",
            points: inPeriod.map((p) => point(p, p.topKg > 0 ? p.topKg : null, weightRecords, formatSet(p.topKg, p.topReps))),
          },
          inPeriod.some((p) => p.e1rmKg != null)
            ? {
                label: "1RM estimado",
                unit: "kg",
                points: inPeriod.map((p) =>
                  point(
                    p,
                    p.e1rmKg,
                    e1rmRecords,
                    p.e1rmKg != null ? `${formatKg(p.e1rmKg)} (${formatSet(p.e1rmSetKg, p.e1rmSetReps)})` : undefined,
                  ),
                ),
              }
            : { note: "1RM estimado: só de séries com até 10 reps — nenhuma neste período." },
          {
            label: "Volume da sessão",
            unit: "volume",
            points: inPeriod.map((p) => point(p, p.volumeKg > 0 ? p.volumeKg : null, none, `${formatVolume(p.volumeKg)} · ${plural(p.sets, "série", "séries")}`)),
          },
        ]
      : mode === "loaded-time"
        ? [
            {
              label: "Melhor carga por sessão",
              unit: "kg",
              points: inPeriod.map((p) => point(p, p.topKg > 0 ? p.topKg : null, weightRecords, formatSet(p.topKg, p.topReps, { timed }))),
            },
            {
              label: "Tempo com a maior carga",
              unit: "seconds",
              points: inPeriod.map((p) => point(p, p.topReps, repRecords, formatSet(p.topKg, p.topReps, { timed }))),
            },
          ]
        : [
            {
              label: timed ? "Maior tempo por sessão" : "Mais reps por sessão",
              unit: timed ? "seconds" : "reps",
              points: inPeriod.map((p) => point(p, p.bestReps, repRecords, bestSetText(p, mode))),
            },
            {
              label: timed ? "Tempo total por sessão" : "Reps totais por sessão",
              unit: timed ? "seconds" : "reps",
              points: inPeriod.map((p) => point(p, p.totalReps, none, `${count(p.totalReps)} em ${plural(p.sets, "série", "séries")}`)),
            },
          ];

  const newestFirst = [...inPeriod].reverse();
  const listed = listAll ? newestFirst : newestFirst.slice(0, LIST_SIZE);
  const periodSpan = PERIODS.find((p) => p.value === period)?.span ?? "";
  const listHref = (all: boolean) =>
    `/app/exercises/${slug}/history?${new URLSearchParams({ period, ...(all ? { sessoes: "todas" } : {}) }).toString()}`;
  const ledger = prs.flatMap((r) => {
    const d = describePr(r, timed);
    return d ? [{ ...d, id: r.id, date: r.achievedAt, sessionId: r.sessionId }] : [];
  });
  const last = history[history.length - 1];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      {backLink}
      <span className="eyebrow">Meu histórico</span>
      <h1 className="text-display mt-0.5 text-[1.75rem] font-semibold leading-tight [overflow-wrap:anywhere] sm:text-[2rem]">
        {exercise.namePt}
      </h1>
      <p className="mt-1.5 text-[15px] text-muted">
        {plural(history.length, "sessão", "sessões")} · última em{" "}
        {formatAppDate(last.date, { day: "2-digit", month: "long", year: "numeric" })}
      </p>

      {marks.length > 0 ? (
        <section className="mt-8">
          <SectionHead label="Melhores marcas" />
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {marks.map((m) => (
              <Card key={m.label}>
                <CardContent className="p-4">
                  <p className="text-[13px] leading-snug text-muted">{m.label}</p>
                  <p className="mt-1 text-xl font-semibold leading-tight tabular-nums">
                    <MarkValue text={m.value} />
                  </p>
                  <p className="mt-1 text-xs tabular-nums text-muted">em {shortDate(m.date)}</p>
                  {m.note ? <p className="mt-1.5 text-xs leading-snug text-muted">{m.note}</p> : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <PeriodChips period={period} basePath={`/app/exercises/${slug}/history`} className="mt-6" />

      {inPeriod.length === 0 ? (
        <div className="card mt-4 px-4 py-3.5 text-[15px]">
          <p>Nenhuma sessão deste exercício {periodSpan}.</p>
          <Link
            href={`/app/exercises/${slug}/history?period=all`}
            className="-mb-2 mt-0.5 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-accent hover:underline"
          >
            Ver todo o histórico
            <GArrow className="size-3.5" />
          </Link>
        </div>
      ) : (
        <>
          <Card className="mt-4">
            <CardContent className="flex flex-col gap-8 pt-5">
              {charts.map((c) =>
                "note" in c ? (
                  <p key={c.note} className="rounded-[var(--radius-md)] bg-surface-2 px-3.5 py-2.5 text-[13px] text-muted">
                    {c.note}
                  </p>
                ) : (
                  <ProgressChart key={c.label} label={c.label} unit={c.unit} points={c.points} step={c.unit === "kg" ? loadStep : undefined} />
                ),
              )}
            </CardContent>
          </Card>

          {ledger.length > 0 ? (
            <details className="group card mt-6 px-4 sm:px-5">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                <span className="text-[15px] font-semibold">Linha do tempo de recordes</span>
                <span className="inline-flex items-center gap-2 text-[13px] tabular-nums text-muted">
                  {ledger.length}
                  <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
                </span>
              </summary>
              <ol className="flex flex-col divide-y divide-border border-t border-border pb-2">
                {ledger.map((r) => (
                  <li key={r.id} className="flex items-baseline gap-3 py-2.5 text-sm" data-record-row>
                    <span className="w-16 shrink-0 text-[13px] tabular-nums text-muted">{shortDate(r.date)}</span>
                    {/* Label and value share a line while they fit; on a narrow phone the
                        value drops under the label (right-aligned) instead of running over it. */}
                    <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <span className="text-muted">{r.label}</span>
                      <span className="ml-auto font-semibold tabular-nums">{r.value}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </details>
          ) : null}

          <section className="mt-8">
            <SectionHead label="Sessões" count={inPeriod.length} />
            {mode === "reps" && listed.some((p) => p.bestRepsKg === 0) ? (
              <p className="mt-1 text-[13px] text-muted">PC = peso corporal</p>
            ) : null}
            <ol className="mt-3 flex flex-col gap-2">
              {listed.map((p) => (
                <li key={p.sessionId}>
                  <Link
                    href={`/app/workout/${p.sessionId}/summary`}
                    className="card is-link group flex min-h-12 items-center justify-between gap-3 px-4 py-2.5 text-[15px]"
                  >
                    <span className="flex items-center gap-2 tabular-nums text-muted">
                      {shortDate(p.date)}
                      {anyRecord.has(p.sessionId) ? (
                        <>
                          <Lettermark code="PR" className="size-4 text-[8px]" />
                          <span className="sr-only">recorde</span>
                        </>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-2.5 font-semibold tabular-nums">
                      {bestSetText(p, mode)}
                      <GArrow className="size-3.5 text-muted group-hover:text-accent" />
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
            {inPeriod.length > LIST_SIZE ? (
              <Link
                href={listHref(!listAll)}
                scroll={false}
                className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-accent hover:underline"
              >
                {listAll ? `Mostrar só as ${LIST_SIZE} últimas` : `Ver todas as ${inPeriod.length} sessões`}
                <GArrow className="size-3.5" />
              </Link>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}

/**
 * A mark on a narrow card: "10 kg × 30 s" wraps before the "×" ("10 kg" /
 * "× 30 s"), never leaving it at the end of a line.
 */
function MarkValue({ text }: { text: string }) {
  const at = text.indexOf(" × ");
  if (at === -1) return <>{text}</>;
  return (
    <>
      <span className="whitespace-nowrap">{text.slice(0, at)}</span>{" "}
      <span className="whitespace-nowrap">{text.slice(at + 1)}</span>
    </>
  );
}
