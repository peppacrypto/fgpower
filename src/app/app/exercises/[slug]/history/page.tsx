import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Lettermark } from "@/components/ui/glyph";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { getExerciseHistory, getExercisePersonalRecords } from "@/lib/data/history";
import { estimate1Rm } from "@/lib/training/estimated-1rm";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { ProgressionChart, type ChartPoint } from "./progression-charts";

const PR_LABEL: Record<string, string> = {
  MAX_WEIGHT: "Maior carga",
  ESTIMATED_1RM: "Melhor 1RM estimado",
  MAX_REPS_AT_WEIGHT: "Recorde de repetições",
  SESSION_VOLUME: "Recorde de volume",
};

export async function generateMetadata({ params }: PageProps<"/app/exercises/[slug]/history">): Promise<Metadata> {
  const { slug } = await params;
  const ex = await prisma.exercise.findUnique({ where: { slug }, select: { namePt: true } });
  return ex ? { title: `Histórico · ${ex.namePt}` } : {};
}

export default async function ExerciseHistoryPage({ params }: PageProps<"/app/exercises/[slug]/history">) {
  const { slug } = await params;
  const user = await requireUser();
  const exercise = await prisma.exercise.findUnique({ where: { slug }, select: { id: true, namePt: true } });
  if (!exercise) notFound();

  const [history, prs] = await Promise.all([
    getExerciseHistory(user.id, exercise.id),
    getExercisePersonalRecords(user.id, exercise.id),
  ]);

  if (history.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <h1 className="text-2xl font-bold tracking-tight">{exercise.namePt}</h1>
        <div className="mt-8">
          <EmptyState
            icon={<Lettermark code="PR" className="size-8 text-[11px]" />}
            title="Sem histórico ainda"
            description="Assim que você registrar séries deste exercício em um treino concluído, o progresso aparece aqui."
          />
        </div>
      </div>
    );
  }

  const chartData: ChartPoint[] = history.map((p) => {
    const est = p.bestWeightKg != null && p.bestReps != null ? estimate1Rm(p.bestWeightKg, p.bestReps) : null;
    return {
      dateLabel: p.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      bestWeightKg: p.bestWeightKg,
      estimated1RmKg: est?.epleyKg ?? null,
      sessionVolumeKg: Math.round(p.sessionVolumeKg),
    };
  });

  const last = history[history.length - 1];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-2xl font-bold tracking-tight">{exercise.namePt}</h1>
      <p className="mt-1 text-sm text-muted">
        {history.length} sessões registradas · última em{" "}
        {last.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
      </p>

      {prs.length > 0 ? (
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {prs.map((pr) => (
            <Card key={pr.id}>
              <CardContent className="py-3.5">
                <p className="text-[11px] font-medium text-muted">{PR_LABEL[pr.kind]}</p>
                <p className="mt-0.5 font-mono text-lg font-bold tabular-nums">
                  {pr.kind === "MAX_REPS_AT_WEIGHT" ? `${pr.weightKg}×${pr.reps}` : Math.round(pr.value * 10) / 10}
                  {pr.kind !== "MAX_REPS_AT_WEIGHT" ? "kg" : ""}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <Card className="mt-6">
        <CardContent className="flex flex-col gap-8 pt-5">
          <ProgressionChart data={chartData} dataKey="bestWeightKg" label="Melhor carga por sessão" unit="kg" />
          <ProgressionChart data={chartData} dataKey="estimated1RmKg" label="1RM estimado" unit="kg" />
          <ProgressionChart data={chartData} dataKey="sessionVolumeKg" label="Volume da sessão" unit="kg" />
        </CardContent>
      </Card>

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Sessões</h2>
        <div className="flex flex-col gap-1.5 font-mono text-sm">
          {[...history].reverse().map((p, i) => (
            <div key={i} className="flex justify-between rounded-[var(--radius-sm)] bg-surface-2 px-3.5 py-2">
              <span className="text-muted">
                {p.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
              </span>
              <span className="tabular-nums">
                {p.bestWeightKg ?? "—"}kg × {p.bestReps ?? "—"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
