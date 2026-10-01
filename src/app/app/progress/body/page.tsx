import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronDown } from "lucide-react";
import { requireUser } from "@/lib/auth/require-user";
import { parsePeriod, periodStartDate, dateOfDayNumber, type ProgressPeriod } from "@/lib/data/progress";
import { getBodyweightPoints, getMeasurements, getRecentWeighIns } from "@/lib/data/body-metrics";
import { getUpcomingPlan } from "@/lib/data/upcoming";
import { SectionHead } from "@/components/ui/section-head";
import { BodyweightChart } from "@/components/charts/bodyweight-chart";
import { monoDate } from "@/components/charts/scale";
import { dayNumberOf } from "@/lib/training/day-rotation";
import { bodyKind, formatBodyDelta, formatBodyValue, measurementWeek, movingAverage7 } from "@/lib/training/body-weight";
import { PeriodChips, PERIODS } from "../period-chips";
import { WeighInForm } from "./weigh-in-form";
import { MeasurementsForm } from "./measurements-form";
import { BodyEntries } from "./body-entries";
import { BodyAnnouncer } from "./body-announcer";

export const metadata: Metadata = { title: "Corpo" };

const DAY_MS = 86_400_000;
/** How far back an entry can be dated (lib/actions/body-metrics). */
const MAX_BACKDATE_DAYS = 366;

/** A day number as an <input type=date> value ("2026-09-28"). */
function isoOfDay(day: number) {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}
const dayLabel = (day: number) => monoDate(dateOfDayNumber(day));
/** EmptyState's panel (components/ui/misc), drawn here around the weigh-in form. */
const EMPTY_PANEL =
  "flex flex-col items-center justify-center gap-3 border-y-2 border-y-[var(--rule-heavy)] bg-surface-2 px-6 py-14 text-center";

/**
 * Corpo (W-083): the weight — daily weigh-ins and the 7-day average that
 * shows the trend — and the circumferences GD asks for at the start and end
 * of every block. Everything here is the user's alone: nothing reaches the
 * feed, the public profile, a shared link or its image.
 */
export default async function BodyPage({ searchParams }: PageProps<"/app/progress/body">) {
  const sp = await searchParams;
  const period: ProgressPeriod = parsePeriod(sp.period, "8w");
  const user = await requireUser();
  const now = new Date();
  const todayNo = dayNumberOf(now);
  const start = periodStartDate(period, now);
  const startDay = start ? dayNumberOf(start) : null;

  const [points, recent, measurements, plan] = await Promise.all([
    // Six days before the period too: its first days get a full 7-day average.
    getBodyweightPoints(user.id, startDay != null ? startDay - 6 : null),
    getRecentWeighIns(user.id, 14),
    getMeasurements(user.id, startDay),
    getUpcomingPlan(user.id, now, null),
  ]);
  const averaged = movingAverage7(points).filter((p) => startDay == null || p.day >= startDay);
  const last = recent[0] ? { kg: recent[0].value, day: recent[0].day } : null;
  const todayIso = isoOfDay(todayNo);
  const minIso = isoOfDay(todayNo - MAX_BACKDATE_DAYS);
  const empty = recent.length === 0 && measurements.length === 0;
  const periodSpan = PERIODS.find((p) => p.value === period)?.span ?? "";

  // The program asks for body data this week (a GD block's first or last week).
  const ask = plan.hasPlan
    ? measurementWeek({
        templateSlug: plan.enrollment.program.sourceTemplate?.slug ?? null,
        week: plan.weekView.guidanceWeek,
        durationWeeks: plan.enrollment.program.durationWeeks,
      })
    : null;
  const weekTag = plan.hasPlan
    ? plan.weekView.kind === "week"
      ? `sem. ${plan.weekView.week}`
      : "semana de entrada"
    : "";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <Link
        href="/app/progress"
        className="-mt-2 -ml-1 inline-flex min-h-11 items-center gap-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" aria-hidden />
        Progresso
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">Corpo</h1>
      <p className="mt-1 text-sm text-muted">Só você vê. Nada daqui aparece no feed nem no seu perfil.</p>
      {/* Above everything that redraws: a list whose last entry is deleted is gone before it's said. */}
      <BodyAnnouncer />

      {ask && plan.hasPlan ? (
        <div className="mt-4 border-l-2 border-l-accent bg-surface-2 px-3 py-2.5" data-measure-banner={ask}>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em]">
            {/* "Semana de medidas · GD 1 · sem. 13": the fixed parts stay whole; a long program name may wrap. */}
            {ask === "measure" ? (
              <>
                <span className="whitespace-nowrap">Semana de medidas</span> · {plan.enrollment.program.name} ·{" "}
                <span className="whitespace-nowrap">{weekTag}</span>
              </>
            ) : (
              "Pese-se toda manhã"
            )}
          </p>
          <p className="mt-0.5 text-xs text-foreground/90">
            {ask === "measure"
              ? "O programa pede o peso médio de 7 dias, cintura e membros."
              : "A média de 7 dias começa aqui: de manhã, depois do banheiro, antes de comer."}
          </p>
        </div>
      ) : null}

      {empty ? null : <PeriodChips period={period} basePath="/app/progress/body" className="mt-4" />}

      <section className="mt-6" aria-labelledby={empty ? "corpo-vazio" : "peso"}>
        {/* With no data yet the weigh-in form sits in the empty state (EmptyState's look). It keeps
            one place in the tree either way, so the first save — which redraws the page with its
            list — keeps the form's focus and its "Salvo ✓". */}
        <div className={empty ? EMPTY_PANEL : undefined}>
          {empty ? (
            <>
              <p id="corpo-vazio" className="text-base font-semibold text-foreground">
                Seu corpo, em números
              </p>
              <p className="max-w-sm text-sm text-muted">
                Registre o peso de manhã e, a cada bloco, cintura e membros. A média de 7 dias mostra a tendência real.
              </p>
            </>
          ) : (
            <SectionHead id="peso" label="Peso" />
          )}
          <WeighInForm
            todayIso={todayIso}
            minIso={minIso}
            last={last}
            className={empty ? "mt-2 w-full max-w-sm text-left" : "mt-4"}
          />
        </div>
        {empty ? null : (
          <>
            {averaged.length > 0 ? (
              <BodyweightChart points={averaged} className="mt-6" />
            ) : (
              <p className="mt-6 text-sm text-muted">Nenhuma pesagem {periodSpan}.</p>
            )}
            <p className="mt-3 text-xs text-muted">
              O peso varia 1–2 kg de um dia para o outro (água, sal, digestão). A média de 7 dias mostra a tendência.
            </p>
            {recent.length > 0 ? (
              <>
                <SectionHead as="h3" label="Pesagens" count={recent.length} className="mt-6" />
                <BodyEntries
                  noun="pesagem"
                  className="mt-2"
                  entries={recent.map((e) => ({
                    id: e.id,
                    date: dayLabel(e.day),
                    value: formatBodyValue(e.value, "kg"),
                    fromWorkout: e.fromWorkout,
                  }))}
                />
              </>
            ) : null}
          </>
        )}
      </section>

      <section id="medidas" className="mt-10 scroll-mt-20" aria-labelledby="medidas-titulo">
        <SectionHead id="medidas-titulo" label="Medidas" />
        <div className="mt-4">
          <MeasurementsForm todayIso={todayIso} minIso={minIso} />
        </div>
        {measurements.length > 0 ? (
          <div className="mt-6 flex flex-col divide-y divide-border border-y border-border" data-measurements>
            {measurements.map((m) => {
              const config = bodyKind(m.kind);
              if (!config) return null;
              const since = m.firstInWindow;
              return (
                <details key={m.kind} className="group/m" data-measurement={m.kind}>
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 py-2 [&::-webkit-details-marker]:hidden">
                    {/* The words wrap on their side; the chevron keeps the first line's end. */}
                    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-sm font-semibold">{config.label}</span>
                      <span className="font-mono text-sm font-semibold tabular-nums">{formatBodyValue(m.latest.value, "cm")}</span>
                      {/* The change may wrap to its own line: its separator ends the line above, never opens it. */}
                      <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
                        · {dayLabel(m.latest.day)}
                        {since ? " ·" : null}
                      </span>
                      {since ? (
                        <span className="font-mono text-[11px] text-muted">
                          {formatBodyDelta(m.latest.value - since.value, "cm")} desde {dayLabel(since.day)}
                        </span>
                      ) : null}
                    </span>
                    <ChevronDown className="size-3.5 shrink-0 text-muted transition-transform group-open/m:rotate-180" aria-hidden />
                  </summary>
                  <BodyEntries
                    noun={config.label.toLowerCase()}
                    className="pb-3"
                    entries={m.entries.map((e) => ({
                      id: e.id,
                      date: dayLabel(e.day),
                      value: formatBodyValue(e.value, "cm"),
                      fromWorkout: false,
                    }))}
                  />
                </details>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 text-xs text-muted">
            Meça no mesmo horário e do mesmo lado a cada vez — no começo e no fim de cada bloco já basta.
          </p>
        )}
      </section>
    </div>
  );
}
