import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Play, Trophy } from "lucide-react";
import { requireUser } from "@/lib/auth/require-user";
import { getProfile } from "@/lib/data/profile";
import {
  getActiveEnrollment,
  getInProgressSession,
  getRecentPersonalRecords,
  getWeeklyProgress,
} from "@/lib/data/dashboard";
import { Button } from "@/components/ui/button";
import { SectionHead } from "@/components/ui/section-head";
import { startAdHocWorkoutSession } from "@/lib/actions/workouts";

export const metadata: Metadata = { title: "Hoje" };

const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

function greeting(hour: number) {
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

const PR_TEXT: Record<string, string> = {
  MAX_WEIGHT: "Recorde de carga",
  ESTIMATED_1RM: "1RM estimado",
  MAX_REPS_AT_WEIGHT: "Recorde de repetições",
  SESSION_VOLUME: "Volume da sessão",
};
const PR_VALUE: Record<string, (v: number, w: number | null, r: number | null) => string> = {
  MAX_WEIGHT: (v) => `${v}kg`,
  ESTIMATED_1RM: (v) => `${v}kg`,
  MAX_REPS_AT_WEIGHT: (_v, w, r) => `${w}×${r}`,
  SESSION_VOLUME: (v) => `${Math.round(v)}kg`,
};

export default async function TodayPage() {
  const user = await requireUser();
  const [profile, enrollment, inProgress, weeklyCount, recentPrs] = await Promise.all([
    getProfile(user.id),
    getActiveEnrollment(user.id),
    getInProgressSession(user.id),
    getWeeklyProgress(user.id),
    getRecentPersonalRecords(user.id),
  ]);

  const now = new Date();
  const firstName = (profile?.displayName ?? user.name).split(" ")[0];
  const nextDay = enrollment?.program.days.find((d) => d.dayIndex === enrollment.nextDayIndex);
  const weeklyTarget = profile?.daysPerWeek ?? 3;
  const dateStr = `${WEEKDAYS[now.getDay()]} · ${String(now.getDate()).padStart(2, "0")} ${MONTHS[now.getMonth()]}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Masthead */}
      <div className="flex items-baseline justify-between">
        <div>
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-muted">{dateStr}</span>
          <h1 className="text-display mt-1 text-3xl font-extrabold sm:text-4xl">
            {greeting(now.getHours())}, {firstName}.
          </h1>
        </div>
      </div>

      {/* Focus block */}
      <div className="mt-8">
        {inProgress ? (
          <FocusBlock
            eyebrow="Treino em andamento"
            title={inProgress.name}
            spine="var(--warning)"
            cta={
              <Button size="lg" asChild>
                <Link href={`/app/workout/${inProgress.id}`}>
                  Continuar
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            }
          />
        ) : nextDay ? (
          <div className="relative overflow-hidden rounded-[var(--radius-xl)] border border-border bg-surface shadow-md">
            <span className="absolute left-0 top-0 h-full w-1.5 bg-accent" aria-hidden />
            <div className="p-6 sm:p-8">
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-accent">
                Próximo treino
              </span>
              <h2 className="text-display mt-2 text-3xl font-extrabold sm:text-4xl">{nextDay.name}</h2>
              <div className="mt-3 flex items-center gap-4 font-mono text-sm text-muted">
                <span>
                  <span className="font-bold text-foreground">{nextDay.exercises.length}</span> exercícios
                </span>
                {nextDay.estimatedMinutes ? (
                  <span>
                    ~<span className="font-bold text-foreground">{nextDay.estimatedMinutes}</span>′
                  </span>
                ) : null}
              </div>

              {/* exercise preview with index numbers */}
              <ol className="mt-5 flex flex-col divide-y divide-border border-y border-border">
                {nextDay.exercises.slice(0, 6).map((ex, i) => (
                  <li key={ex.id} className="flex items-center gap-3 py-2.5">
                    <span className="w-5 font-mono text-xs text-foreground/30">{String(i + 1).padStart(2, "0")}</span>
                    <span className="flex-1 truncate text-sm font-medium">{ex.exercise.namePt}</span>
                  </li>
                ))}
                {nextDay.exercises.length > 6 ? (
                  <li className="py-2.5 pl-8 text-xs text-muted">+{nextDay.exercises.length - 6} exercícios</li>
                ) : null}
              </ol>

              <form action={startAdHocWorkoutSession.bind(null, nextDay.id)} className="mt-6">
                <Button type="submit" size="lg" variant="strong" className="w-full sm:w-auto">
                  <Play className="size-4" />
                  Iniciar treino
                </Button>
              </form>
            </div>
          </div>
        ) : (
          <div className="rounded-[var(--radius-xl)] border border-dashed border-border-strong p-8 text-center">
            <p className="text-display text-2xl font-bold">Sem programa ativo.</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
              Escolha um protocolo pronto ou monte o seu para começar a treinar.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button variant="strong" asChild>
                <Link href="/app/programs">Explorar programas</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/app/programs/new">Criar do zero</Link>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {enrollment ? (
          <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Programa</span>
            <p className="mt-1.5 truncate text-sm font-semibold">{enrollment.program.name}</p>
            {enrollment.program.durationWeeks ? (
              <>
                <p className="mt-3 font-mono text-2xl font-bold tabular-nums">
                  {enrollment.currentWeek}
                  <span className="text-base text-muted"> / {enrollment.program.durationWeeks}</span>
                </p>
                <div className="mt-2 flex gap-1">
                  {Array.from({ length: enrollment.program.durationWeeks }, (_, i) => (
                    <span
                      key={i}
                      className={`h-1 flex-1 rounded-full ${i < enrollment.currentWeek ? "bg-accent" : "bg-surface-2"}`}
                    />
                  ))}
                </div>
                <span className="mt-1.5 block text-[10px] uppercase tracking-wider text-muted">semanas</span>
              </>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Esta semana</span>
          <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums">
            {weeklyCount}
            <span className="text-base text-muted"> / {weeklyTarget}</span>
          </p>
          <div className="mt-3 flex gap-1.5">
            {Array.from({ length: weeklyTarget }, (_, i) => (
              <span
                key={i}
                className={`h-8 flex-1 rounded-[4px] ${i < weeklyCount ? "bg-accent" : "border border-border bg-surface-2"}`}
              />
            ))}
          </div>
          <span className="mt-1.5 block text-[10px] uppercase tracking-wider text-muted">treinos concluídos</span>
        </div>
      </div>

      {/* PRs */}
      {recentPrs.length > 0 ? (
        <section className="mt-10">
          <SectionHead label="Recordes recentes" />
          <div className="mt-4 flex flex-col divide-y divide-border border-y border-border">
            {recentPrs.map((pr) => (
              <Link
                key={pr.id}
                href={`/app/exercises/${pr.exercise.slug}/history`}
                className="group flex items-center gap-4 py-3.5 hover:bg-surface-2/50"
              >
                <Trophy className="size-4 shrink-0 text-accent" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{pr.exercise.namePt}</p>
                  <p className="text-[11px] uppercase tracking-wider text-muted">
                    {PR_TEXT[pr.kind]}
                  </p>
                </div>
                <span className="font-mono text-lg font-bold tabular-nums">
                  {PR_VALUE[pr.kind]?.(pr.value, pr.weightKg, pr.reps)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function FocusBlock({
  eyebrow,
  title,
  spine,
  cta,
}: {
  eyebrow: string;
  title: string;
  spine: string;
  cta: React.ReactNode;
}) {
  return (
    <div className="relative flex items-center justify-between gap-4 overflow-hidden rounded-[var(--radius-xl)] border border-border bg-surface p-6 shadow-md sm:p-8">
      <span className="absolute left-0 top-0 h-full w-1.5" style={{ background: spine }} aria-hidden />
      <div>
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-warning">{eyebrow}</span>
        <h2 className="text-display mt-1.5 text-2xl font-extrabold sm:text-3xl">{title}</h2>
      </div>
      {cta}
    </div>
  );
}
