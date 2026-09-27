import type { Metadata } from "next";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { GArrow, Lettermark } from "@/components/ui/glyph";
import { requireUser } from "@/lib/auth/require-user";
import { getProgressSummary, getExerciseProgressDeltas, type ProgressPeriod } from "@/lib/data/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { describeRecord } from "@/lib/training/personal-records-core";
import { formatAppDate } from "@/lib/training/week";
import { formatKg } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Progresso" };

const PERIODS: { value: ProgressPeriod; label: string }[] = [
  { value: "4w", label: "4 semanas" },
  { value: "8w", label: "8 semanas" },
  { value: "3m", label: "3 meses" },
  { value: "6m", label: "6 meses" },
  { value: "1y", label: "1 ano" },
  { value: "all", label: "Tudo" },
];

export default async function ProgressPage({ searchParams }: PageProps<"/app/progress">) {
  const sp = await searchParams;
  const period: ProgressPeriod = (typeof sp.period === "string" ? sp.period : "8w") as ProgressPeriod;
  const user = await requireUser();

  const [summary, deltas] = await Promise.all([
    getProgressSummary(user.id, period),
    getExerciseProgressDeltas(user.id, period),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Progresso</h1>
        {/* Every past workout, by date and on the calendar. */}
        <Link
          href="/app/history"
          className="-my-2 inline-flex items-center gap-1 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-accent hover:underline"
        >
          Histórico
          <GArrow className="size-3" />
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {PERIODS.map((p) => (
          <Link
            key={p.value}
            href={`/app/progress?period=${p.value}`}
            className={
              p.value === period
                ? "inline-flex min-h-11 items-center rounded-[2px] border border-accent bg-accent-soft px-3 text-xs font-semibold text-accent"
                : "inline-flex min-h-11 items-center rounded-[2px] px-3 text-xs text-muted hover:bg-surface-2"
            }
          >
            {p.label}
          </Link>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Link href="/app/history" aria-label={`Treinos concluídos: ${summary.sessionCount} — ver histórico`}>
          <Card className="is-link h-full">
            <CardContent className="pt-5">
              <p className="flex items-center justify-between gap-2 text-xs font-medium text-muted">
                Treinos concluídos
                <GArrow className="size-3" />
              </p>
              <p className="mt-1 font-mono text-2xl font-bold tabular-nums">{summary.sessionCount}</p>
            </CardContent>
          </Card>
        </Link>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-medium text-muted">Consistência</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums">
              {summary.consistencyPct != null ? `${summary.consistencyPct}%` : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {summary.activeEnrollment ? (
        <Card className="mt-3">
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="text-xs font-medium text-muted">Programa atual</p>
              <p className="font-semibold">{summary.activeEnrollment.program.name}</p>
            </div>
            <Badge variant="accent">Semana {summary.activeEnrollment.currentWeek}</Badge>
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
          <TrendingUp className="size-4" />
          Evolução por exercício
        </h2>
        {deltas.length === 0 ? (
          <EmptyState title="Ainda sem dados suficientes" description="Treine o mesmo exercício mais de uma vez para ver sua evolução aqui." />
        ) : (
          <div className="flex flex-col gap-2">
            {deltas.map((d) => (
              <Link key={d.slug} href={`/app/exercises/${d.slug}/history`}>
                <Card className="is-link">
                  <CardContent className="flex items-center justify-between gap-3 py-3.5">
                    <span className="min-w-0 text-sm font-medium">{d.namePt}</span>
                    <span
                      className={`shrink-0 whitespace-nowrap font-mono text-sm font-semibold tabular-nums ${d.deltaKg > 0 ? "text-success" : "text-muted"}`}
                    >
                      {d.deltaKg > 0 ? "+" : "−"}
                      {formatKg(Math.abs(d.deltaKg))}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
          <Lettermark code="PR" className="size-5 text-[9px]" />
          Recordes recentes
        </h2>
        {summary.recentPrs.length === 0 ? (
          <EmptyState title="Nenhum recorde neste período" />
        ) : (
          <div className="flex flex-col gap-2">
            {summary.recentPrs.map((pr) => (
              <Link key={pr.exerciseId} href={`/app/exercises/${pr.slug}/history`}>
                <Card className="is-link">
                  <CardContent className="py-3.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 flex-1 text-sm font-medium">{pr.namePt}</span>
                      <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted">
                        {formatAppDate(pr.achievedAt, { day: "2-digit", month: "short" })}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs tabular-nums text-muted">
                      {pr.records.map((r) => describeRecord(r)).join(" · ")}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
