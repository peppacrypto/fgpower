import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/require-user";
import { getExerciseSeries } from "@/lib/data/progress";
import { bestSetText, progressMode, type ProgressMode, type SessionPerf } from "@/lib/data/progress-core";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { SectionHead } from "@/components/ui/section-head";
import { Sparkline } from "@/components/charts/sparkline";
import { EmptyChartPreview } from "@/components/charts/empty-chart";
import { formatValue, shortDate, type ChartUnit } from "@/components/charts/scale";
import { plural } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Meus exercícios" };

/**
 * The number a row's sparkline follows: the e1RM when most of the recent
 * sessions give one, else the top load; reps (or seconds) without a load.
 */
function trendOf(recent: SessionPerf[], mode: ProgressMode): { values: number[]; unit: ChartUnit; what: string } {
  if (mode === "reps" || mode === "time") {
    return {
      values: recent.map((p) => p.bestReps),
      unit: mode === "time" ? "seconds" : "reps",
      what: mode === "time" ? "Maior tempo" : "Mais reps",
    };
  }
  const withE1rm = recent.filter((p) => p.e1rmKg != null);
  if (mode === "load" && withE1rm.length * 2 >= recent.length) {
    return { values: withE1rm.map((p) => p.e1rmKg as number), unit: "kg", what: "1RM estimado" };
  }
  return { values: recent.filter((p) => p.topKg > 0).map((p) => p.topKg), unit: "kg", what: "Maior carga" };
}

/** Every exercise the user has trained, the most recent first — each one's way into its history. */
export default async function MyExercisesPage() {
  const user = await requireUser();
  const series = await getExerciseSeries(user.id, { since: null, recent: 12 });
  const rows = series
    .map((s) => {
      const mode = progressMode(s.recent, s);
      const latest = s.recent[s.recent.length - 1];
      return { ...s, mode, latest, trend: trendOf(s.recent, mode) };
    })
    .sort((a, b) => b.latest.date.getTime() - a.latest.date.getTime() || a.namePt.localeCompare(b.namePt, "pt-BR"));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href="/app/progress"
        className="-mt-2 -ml-1.5 inline-flex min-h-11 items-center gap-0.5 text-sm font-medium text-muted hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Progresso
      </Link>
      <h1 className="text-display text-[1.75rem] font-semibold leading-tight sm:text-[2rem]">Meus exercícios</h1>
      <p className="mt-1.5 text-[15px] text-muted">Cada exercício que você já treinou, do mais recente ao mais antigo.</p>

      {rows.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<EmptyChartPreview />}
            title="Nenhum exercício treinado ainda"
            description="Depois do seu primeiro treino, cada exercício aparece aqui com a sua evolução."
            action={
              <Button variant="strong" asChild className="mt-1">
                <Link href="/app/today">Ir para Hoje</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <section className="mt-8">
          <SectionHead label="Exercícios" count={rows.length} />
          <div className="mt-3 flex flex-col gap-2">
            {rows.map((r) => (
              <Link key={r.exerciseId} href={`/app/exercises/${r.slug}/history`}>
                <Card className="is-link">
                  <CardContent className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-medium leading-snug">{r.namePt}</p>
                      <p className="mt-0.5 text-[13px] tabular-nums text-muted">
                        <span className="whitespace-nowrap">{shortDate(r.latest.date)}</span>
                        {" · "}
                        <span className="whitespace-nowrap">{bestSetText(r.latest, r.mode)}</span>
                        {" · "}
                        <span className="whitespace-nowrap">{plural(r.sessionCount, "sessão", "sessões")}</span>
                      </p>
                    </div>
                    {r.trend.values.length > 1 ? (
                      <Sparkline
                        values={r.trend.values}
                        width={56}
                        height={20}
                        label={`${r.trend.what} nas últimas ${r.trend.values.length} sessões: de ${formatValue(r.trend.values[0], r.trend.unit)} para ${formatValue(r.trend.values[r.trend.values.length - 1], r.trend.unit)}`}
                      />
                    ) : null}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
