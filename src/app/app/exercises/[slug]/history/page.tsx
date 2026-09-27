import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Lettermark } from "@/components/ui/glyph";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { getExerciseHistory, getExercisePersonalRecords } from "@/lib/data/history";
import { formatAppDate } from "@/lib/training/week";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { SectionHead } from "@/components/ui/section-head";
import { formatNumber, formatKg, formatVolume, plural } from "@/lib/utils/format";
import { formatSet, isTimedHold } from "@/lib/training/set-plan";
import { ProgressionChart, type ChartPoint } from "./progression-charts";
import { NOT_FOUND_TITLE } from "@/components/ui/not-found-panel";

export async function generateMetadata({ params }: PageProps<"/app/exercises/[slug]/history">): Promise<Metadata> {
  const { slug } = await params;
  const ex = await prisma.exercise.findUnique({ where: { slug }, select: { namePt: true } });
  return ex ? { title: `Histórico · ${ex.namePt}` } : { title: NOT_FOUND_TITLE };
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

  const chartData: ChartPoint[] = history.map((p) => ({
    dateLabel: formatAppDate(p.date, { day: "2-digit", month: "2-digit" }),
    bestWeightKg: p.bestWeightKg,
    estimated1RmKg: p.estimated1RmKg,
    sessionVolumeKg: Math.round(p.sessionVolumeKg),
    bestReps: p.bestReps,
  }));
  // A hold's "reps" are seconds; with no load ever lifted (bodyweight), the
  // charts follow the reps (or seconds) instead of a flat 0 kg.
  const timed = isTimedHold({ slug });
  const everLoaded = history.some((p) => (p.bestWeightKg ?? 0) > 0);
  const count = (n: number) => (timed ? `${formatNumber(n, 0)}\u00a0s` : plural(n, "rep", "reps"));

  const last = history[history.length - 1];
  // Best marks from every logged session — the first one (the baseline) included.
  const heaviest = history.reduce((best, p) =>
    (p.bestWeightKg ?? 0) > (best.bestWeightKg ?? 0) ||
    ((p.bestWeightKg ?? 0) === (best.bestWeightKg ?? 0) && (p.bestReps ?? 0) > (best.bestReps ?? 0))
      ? p
      : best,
  );
  const best1Rm = Math.max(0, ...history.map((p) => p.estimated1RmKg ?? 0));
  const bestVolume = Math.max(0, ...history.map((p) => p.sessionVolumeKg));
  const repRecord = prs.find((pr) => pr.kind === "MAX_REPS_AT_WEIGHT");
  const marks = [
    heaviest.bestWeightKg
      ? { label: "Maior carga", value: formatSet(heaviest.bestWeightKg, heaviest.bestReps, { timed }) }
      : heaviest.bestReps
        ? { label: timed ? "Maior tempo" : "Mais repetições", value: count(heaviest.bestReps) }
        : null,
    // A hold's seconds give no 1RM, and kg × seconds is no volume.
    best1Rm > 0 && !timed ? { label: "Melhor 1RM est.", value: formatKg(best1Rm) } : null,
    bestVolume > 0 && !timed ? { label: "Maior volume", value: formatVolume(bestVolume) } : null,
    repRecord?.reps != null
      ? {
          label: timed ? "Último recorde de tempo" : "Último recorde de reps",
          value: repRecord.weightKg ? formatSet(repRecord.weightKg, repRecord.reps, { timed }) : count(repRecord.reps),
        }
      : null,
  ].filter((m) => m !== null);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-2xl font-bold tracking-tight">{exercise.namePt}</h1>
      <p className="mt-1 text-sm text-muted">
        {plural(history.length, "sessão registrada", "sessões registradas")} · última em{" "}
        {formatAppDate(last.date, { day: "2-digit", month: "long", year: "numeric" })}
      </p>

      {marks.length > 0 ? (
        <section className="mt-6">
          <SectionHead label="Melhores marcas" />
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {marks.map((m) => (
              <Card key={m.label}>
                <CardContent className="py-3.5">
                  <p className="text-[11px] font-medium text-muted">{m.label}</p>
                  <p className="mt-0.5 font-mono text-lg font-bold tabular-nums">
                    <MarkValue text={m.value} />
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <Card className="mt-6">
        <CardContent className="flex flex-col gap-8 pt-5">
          {everLoaded && timed ? (
            // A loaded hold (Pinça de Anilha): the load, and the seconds held.
            <>
              <ProgressionChart data={chartData} dataKey="bestWeightKg" label="Melhor carga por sessão" format="kg" />
              <ProgressionChart data={chartData} dataKey="bestReps" label="Tempo com a maior carga" format="seconds" />
            </>
          ) : everLoaded ? (
            <>
              <ProgressionChart data={chartData} dataKey="bestWeightKg" label="Melhor carga por sessão" format="kg" />
              <ProgressionChart data={chartData} dataKey="estimated1RmKg" label="1RM estimado" format="kg" />
              <ProgressionChart data={chartData} dataKey="sessionVolumeKg" label="Volume da sessão" format="volume" />
            </>
          ) : (
            <ProgressionChart
              data={chartData}
              dataKey="bestReps"
              label={timed ? "Maior tempo por sessão" : "Mais reps por sessão"}
              format={timed ? "seconds" : "reps"}
            />
          )}
        </CardContent>
      </Card>

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Sessões</h2>
        <div className="flex flex-col gap-1.5 font-mono text-sm">
          {[...history].reverse().map((p, i) => (
            <div key={i} className="flex justify-between rounded-[var(--radius-sm)] bg-surface-2 px-3.5 py-2">
              <span className="text-muted">
                {formatAppDate(p.date, { day: "2-digit", month: "short" })}
              </span>
              <span className="tabular-nums">{formatSet(p.bestWeightKg, p.bestReps, { timed })}</span>
            </div>
          ))}
        </div>
      </div>
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
