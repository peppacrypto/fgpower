import { notFound } from "next/navigation";
import Link from "next/link";
import { Lettermark } from "@/components/ui/glyph";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShareWorkoutForm } from "./share-workout-form";

const PR_LABEL: Record<string, (v: number, w: number | null, r: number | null) => string> = {
  MAX_WEIGHT: (v) => `Novo recorde de carga: ${v}kg`,
  ESTIMATED_1RM: (v) => `Novo 1RM estimado: ${v}kg`,
  MAX_REPS_AT_WEIGHT: (_v, w, r) => `Novo recorde de repetições: ${w}kg × ${r}`,
  SESSION_VOLUME: (v) => `Novo volume recorde: ${Math.round(v)}kg`,
};

export default async function WorkoutSummaryPage({ params }: PageProps<"/app/workout/[sessionId]/summary">) {
  const { sessionId } = await params;
  const user = await requireUser();

  const session = await prisma.workoutSession.findUnique({
    where: { id: sessionId },
    include: {
      exerciseLogs: {
        orderBy: { sortOrder: "asc" },
        include: { exercise: { select: { namePt: true } }, sets: true },
      },
      records: { include: { exercise: { select: { namePt: true } } } },
      activity: true,
    },
  });
  if (!session || session.userId !== user.id) notFound();

  const minutes = session.durationSeconds ? Math.round(session.durationSeconds / 60) : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">Treino concluído</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{session.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {minutes != null ? `${minutes} min` : ""} · {session.totalWorkingSets ?? 0} séries de trabalho
          {session.totalVolumeKg ? ` · ${Math.round(session.totalVolumeKg)}kg de volume` : ""}
        </p>
      </div>

      {session.records.length > 0 ? (
        <div className="mt-6 flex flex-col gap-2">
          {session.records.map((pr) => (
            <Card key={pr.id} className="border-accent/40 bg-accent-soft">
              <CardContent className="flex items-center gap-3 py-3">
                <Lettermark code="PR" className="size-5 shrink-0 text-[9px]" />
                <div>
                  <p className="text-sm font-semibold">{pr.exercise.namePt}</p>
                  <p className="text-xs text-muted">{PR_LABEL[pr.kind]?.(pr.value, pr.weightKg, pr.reps)}</p>
                </div>
                <Badge variant="accent" className="ml-auto">
                  PR
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-2">
        {session.exerciseLogs.map((log) => {
          const workingSets = log.sets.filter((s) => s.isCompleted && s.setType !== "WARMUP");
          if (workingSets.length === 0) return null;
          return (
            <Card key={log.id}>
              <CardContent className="py-3.5">
                <p className="text-sm font-semibold">{log.exercise.namePt}</p>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-sm tabular-nums text-muted">
                  {workingSets.map((s) => (
                    <span key={s.id}>
                      {s.weightKg ?? "—"}kg × {s.reps ?? "—"}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6">
        <CardContent className="pt-5">
          <h2 className="text-sm font-bold">Compartilhar treino</h2>
          <p className="mt-1 text-xs text-muted">
            Você decide o que aparece. Cargas ficam ocultas por padrão mesmo em treinos públicos.
          </p>
          <ShareWorkoutForm
            sessionId={session.id}
            initialVisibility={session.activity?.visibility ?? session.visibility}
            initialShowDetailedLoads={session.activity?.showDetailedLoads ?? false}
            initialCaption={session.activity?.caption ?? ""}
          />
        </CardContent>
      </Card>

      <div className="mt-6 text-center">
        <Button variant="ghost" asChild>
          <Link href="/app/today">Voltar para hoje</Link>
        </Button>
      </div>
    </div>
  );
}
