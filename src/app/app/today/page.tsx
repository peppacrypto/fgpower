import type { Metadata } from "next";
import Link from "next/link";
import { Play, Trophy, Dumbbell } from "lucide-react";
import { requireUser } from "@/lib/auth/require-user";
import { getProfile } from "@/lib/data/profile";
import {
  getActiveEnrollment,
  getInProgressSession,
  getRecentPersonalRecords,
  getWeeklyProgress,
} from "@/lib/data/dashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ProgressBar } from "@/components/ui/misc";
import { startAdHocWorkoutSession } from "@/lib/actions/workouts";

export const metadata: Metadata = { title: "Hoje" };

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function TodayPage() {
  const user = await requireUser();
  const [profile, enrollment, inProgress, weeklyCount, recentPrs] = await Promise.all([
    getProfile(user.id),
    getActiveEnrollment(user.id),
    getInProgressSession(user.id),
    getWeeklyProgress(user.id),
    getRecentPersonalRecords(user.id),
  ]);

  const firstName = (profile?.displayName ?? user.name).split(" ")[0];
  const nextDay = enrollment?.program.days.find((d) => d.dayIndex === enrollment.nextDayIndex);
  const weeklyTarget = profile?.daysPerWeek ?? 3;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-2xl font-bold tracking-tight">
        {greeting()}, {firstName}
      </h1>

      {inProgress ? (
        <Card className="mt-6 border-accent/40 bg-accent-soft">
          <CardContent className="flex items-center justify-between gap-4 pt-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">Treino em andamento</p>
              <p className="mt-1 font-semibold">{inProgress.name}</p>
            </div>
            <Button asChild>
              <Link href={`/app/workout/${inProgress.id}`}>Continuar</Link>
            </Button>
          </CardContent>
        </Card>
      ) : nextDay ? (
        <Card className="mt-6">
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Hoje</p>
            <h2 className="mt-1 text-xl font-bold">{nextDay.name}</h2>
            <p className="mt-1 text-sm text-muted">
              {nextDay.exercises.length} exercícios
              {nextDay.estimatedMinutes ? ` · ~${nextDay.estimatedMinutes} min` : ""}
            </p>
            <form action={startAdHocWorkoutSession.bind(null, nextDay.id)} className="mt-4">
              <Button type="submit" size="lg" className="w-full sm:w-auto">
                <Play className="size-4" />
                Iniciar treino
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6">
          <EmptyState
            icon={<Dumbbell className="size-8" />}
            title="Nenhum programa ativo"
            description="Escolha um programa pronto ou monte o seu para começar a treinar."
            action={
              <div className="flex gap-2">
                <Button asChild>
                  <Link href="/app/programs">Explorar programas</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/app/programs/new">Criar programa</Link>
                </Button>
              </div>
            }
          />
        </div>
      )}

      {enrollment ? (
        <Card className="mt-4">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{enrollment.program.name}</span>
              {enrollment.program.durationWeeks ? (
                <span className="text-muted">
                  Semana {enrollment.currentWeek} de {enrollment.program.durationWeeks}
                </span>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="mt-4">
        <CardContent className="pt-5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Progresso semanal</span>
            <span className="text-muted">
              {weeklyCount} / {weeklyTarget} treinos
            </span>
          </div>
          <ProgressBar value={(weeklyCount / weeklyTarget) * 100} className="mt-3" />
        </CardContent>
      </Card>

      {recentPrs.length > 0 ? (
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Recordes recentes</h2>
          <div className="flex flex-col gap-2">
            {recentPrs.map((pr) => (
              <Card key={pr.id}>
                <CardContent className="flex items-center gap-3 py-3.5">
                  <Trophy className="size-5 text-accent" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{pr.exercise.namePt}</p>
                    <p className="text-xs text-muted">
                      {pr.kind === "MAX_WEIGHT" ? `Novo recorde de carga: ${pr.value}kg` : null}
                      {pr.kind === "ESTIMATED_1RM" ? `Novo 1RM estimado: ${pr.value}kg` : null}
                      {pr.kind === "MAX_REPS_AT_WEIGHT" ? `Novo recorde de reps: ${pr.weightKg}kg × ${pr.reps}` : null}
                      {pr.kind === "SESSION_VOLUME" ? `Novo volume recorde: ${Math.round(pr.value)}kg` : null}
                    </p>
                  </div>
                  <Badge variant="accent">PR</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
