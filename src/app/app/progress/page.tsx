import type { Metadata } from "next";
import Link from "next/link";
import { Trophy, TrendingUp } from "lucide-react";
import { requireUser } from "@/lib/auth/require-user";
import { getProgressSummary, getExerciseProgressDeltas, type ProgressPeriod } from "@/lib/data/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Progresso" };

const PERIODS: { value: ProgressPeriod; label: string }[] = [
  { value: "4w", label: "4 semanas" },
  { value: "8w", label: "8 semanas" },
  { value: "3m", label: "3 meses" },
  { value: "6m", label: "6 meses" },
  { value: "1y", label: "1 ano" },
  { value: "all", label: "Tudo" },
];

const PR_LABEL: Record<string, (v: number, w: number | null, r: number | null) => string> = {
  MAX_WEIGHT: (v) => `${v}kg`,
  ESTIMATED_1RM: (v) => `1RM ~${v}kg`,
  MAX_REPS_AT_WEIGHT: (_v, w, r) => `${w}kg × ${r}`,
  SESSION_VOLUME: (v) => `${Math.round(v)}kg de volume`,
};

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
      <h1 className="text-2xl font-bold tracking-tight">Progresso</h1>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {PERIODS.map((p) => (
          <Link
            key={p.value}
            href={`/app/progress?period=${p.value}`}
            className={
              p.value === period
                ? "rounded-full border border-accent bg-accent-soft px-3 py-1 text-xs font-semibold text-accent"
                : "rounded-full border border-border px-3 py-1 text-xs text-muted hover:bg-surface-2"
            }
          >
            {p.label}
          </Link>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-medium text-muted">Treinos concluídos</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums">{summary.sessionCount}</p>
          </CardContent>
        </Card>
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
                <Card className="transition-colors hover:border-accent/50">
                  <CardContent className="flex items-center justify-between py-3.5">
                    <span className="text-sm font-medium">{d.namePt}</span>
                    <span className="font-mono text-sm font-semibold tabular-nums text-success">
                      {d.deltaKg > 0 ? "+" : ""}
                      {d.deltaKg}kg
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
          <Trophy className="size-4" />
          Recordes recentes
        </h2>
        {summary.recentPrs.length === 0 ? (
          <EmptyState title="Nenhum recorde neste período" />
        ) : (
          <div className="flex flex-col gap-2">
            {summary.recentPrs.map((pr) => (
              <Card key={pr.id}>
                <CardContent className="flex items-center justify-between py-3.5">
                  <span className="text-sm font-medium">{pr.exercise.namePt}</span>
                  <span className="font-mono text-sm tabular-nums text-muted">
                    {PR_LABEL[pr.kind]?.(pr.value, pr.weightKg, pr.reps)}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
