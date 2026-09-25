import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Play } from "lucide-react";
import { GArrow, GCheck, GLoad, Lettermark } from "@/components/ui/glyph";
import { requireUser } from "@/lib/auth/require-user";
import { getProfile } from "@/lib/data/profile";
import {
  getActiveEnrollment,
  getDaysDoneThisWeek,
  getInProgressSessions,
  getRecentPersonalRecords,
  getWeeklyProgress,
} from "@/lib/data/dashboard";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { SectionHead } from "@/components/ui/section-head";
import { DayActions, DayStatus, dayStates } from "@/components/workout/day-actions";
import { formatDecimal } from "@/lib/training/set-plan";
import { APP_TIME_ZONE, wallClock } from "@/lib/training/week";
import { DiscardSessionButton } from "@/components/workout/discard-session-button";
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
  MAX_WEIGHT: (v) => `${formatDecimal(v)}kg`,
  ESTIMATED_1RM: (v) => `${formatDecimal(v)}kg`,
  MAX_REPS_AT_WEIGHT: (_v, w, r) => `${formatDecimal(w) || "—"}×${r}`,
  SESSION_VOLUME: (v) => `${Math.round(v)}kg`,
};

export default async function TodayPage({ searchParams }: PageProps<"/app/today">) {
  const sp = await searchParams;
  const justActivated = sp.ativado === "1";
  const user = await requireUser();
  const [profile, enrollment, inProgress, weeklyCount, recentPrs] = await Promise.all([
    getProfile(user.id),
    getActiveEnrollment(user.id),
    getInProgressSessions(user.id),
    getWeeklyProgress(user.id),
    getRecentPersonalRecords(user.id),
  ]);
  const days = enrollment?.program.days ?? [];
  const done = enrollment
    ? await getDaysDoneThisWeek(user.id, enrollment.id, days)
    : { byDayId: new Map<string, string>(), sessionCount: 0 };
  const doneThisWeek = done.byDayId;

  const now = new Date();
  const firstName = (profile?.displayName ?? user.name).split(" ")[0];
  // The hero suggests the next day not yet trained this week, starting from
  // the program's pointer. A program can prescribe more sessions a week than
  // it has days (A/B at 3×/week): once every day is done, keep offering the
  // pointer day until the weekly frequency is met; then the week is complete.
  // Plans named by weekday (Seg…Sex) start each week over from the first day,
  // even if last week ended early; rotating A/B plans keep their pointer.
  const repeatsDays = (enrollment?.program.daysPerWeek ?? 0) > days.length;
  const startAt =
    !repeatsDays && done.sessionCount === 0
      ? 0
      : Math.max(0, days.findIndex((d) => d.dayIndex === enrollment?.nextDayIndex));
  const weeklyGoal = Math.max(days.length, enrollment?.program.daysPerWeek ?? 0);
  const nextDay =
    days.map((_, i) => days[(startAt + i) % days.length]).find((d) => !doneThisWeek.has(d.id)) ??
    (done.sessionCount < weeklyGoal ? days[startAt] : undefined);
  const weekComplete = days.length > 0 && !nextDay;
  // Only a workout with something logged blocks starting another day (the
  // server discards untouched open sessions when a new day starts).
  const locked = inProgress.some((s) => s.hasData);
  // With a plan, "Esta semana" counts what the plan counts: distinct days, plus
  // repeats only where the plan repeats days (A/B at 3×) — a redo isn't a new workout.
  const hasPlan = days.length > 0;
  const weeklyTarget = hasPlan ? weeklyGoal : (profile?.daysPerWeek ?? 3);
  const weeklyDone = hasPlan
    ? doneThisWeek.size + Math.max(0, Math.min(done.sessionCount - doneThisWeek.size, weeklyGoal - days.length))
    : weeklyCount;
  const states = dayStates(days, inProgress, doneThisWeek);
  const wall = wallClock(now, APP_TIME_ZONE);
  const dateStr = `${WEEKDAYS[wall.weekday]} · ${String(wall.day).padStart(2, "0")} ${MONTHS[wall.month - 1]}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Masthead */}
      <div className="flex items-baseline justify-between">
        <div>
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-muted">{dateStr}</span>
          <h1 className="text-display mt-1 text-3xl font-extrabold sm:text-4xl">
            {greeting(wall.hour)}, {firstName}.
          </h1>
        </div>
      </div>

      {/* Focus block */}
      <div className="mt-8">
        {inProgress.length > 0 ? (
          <div className="flex flex-col gap-3">
            {inProgress.map((session) => (
              <InProgressBlock
                key={session.id}
                sessionId={session.id}
                name={session.name}
                setsDone={session.registered}
                startedAt={session.startedAt}
                now={now}
              />
            ))}
          </div>
        ) : nextDay ? (
          <div className="relative overflow-hidden panel-raised">
            <span className="absolute left-0 top-0 h-full w-1.5 bg-accent" aria-hidden />
            <div className="p-6 sm:p-8">
              {justActivated ? (
                <span className="mb-2 inline-flex items-center gap-1.5 bg-accent-soft px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-accent">
                  <GCheck className="size-3.5" />
                  Programa ativado
                </span>
              ) : null}
              <span className="block font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-accent">
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

              {/* exercise preview with thumbnails */}
              <ol className="mt-5 flex flex-col divide-y divide-border border-y border-border">
                {nextDay.exercises.slice(0, 6).map((ex) => (
                  <li key={ex.id} className="flex items-center gap-3 py-2">
                    <div className="relative size-10 shrink-0 overflow-hidden rounded-[3px] bg-surface-2">
                      {ex.exercise.media?.[0]?.url ? (
                        <Image src={ex.exercise.media[0].url} alt="" fill sizes="40px" className="object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted">
                          <GLoad className="size-4" />
                        </div>
                      )}
                    </div>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{ex.exercise.namePt}</span>
                  </li>
                ))}
                {nextDay.exercises.length > 6 ? (
                  <li className="py-2 pl-[52px] text-xs text-muted">+{nextDay.exercises.length - 6} exercícios</li>
                ) : null}
              </ol>

              <form action={startAdHocWorkoutSession.bind(null, nextDay.id)} className="mt-6">
                <SubmitButton size="lg" variant="strong" className="w-full sm:w-auto" pendingLabel="Iniciando…">
                  <Play className="size-4" />
                  Iniciar treino
                </SubmitButton>
              </form>
            </div>
          </div>
        ) : weekComplete ? (
          <div className="relative overflow-hidden panel-raised p-6 sm:p-8">
            <span className="absolute left-0 top-0 h-full w-1.5 bg-accent" aria-hidden />
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-accent">
              <GCheck className="size-3.5" />
              Semana concluída
            </span>
            <h2 className="text-display mt-2 text-2xl font-extrabold sm:text-3xl">Todos os treinos da semana feitos.</h2>
            <p className="mt-2 text-sm text-muted">Descanse. Os resultados de cada dia estão logo abaixo.</p>
          </div>
        ) : (
          <div className="border-y-2 border-y-[var(--rule-heavy)] bg-surface-2 p-8 text-center">
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

      {/* Every day of the program, with where it stands this week */}
      {enrollment && days.length > 0 ? (
        <section className="mt-6">
          <SectionHead label="Treinos do programa" count={`${days.length} ${days.length === 1 ? "dia" : "dias"}`} />
          {locked ? (
            <p className="mt-2 text-xs text-muted">Finalize ou descarte o treino em andamento para iniciar outro dia.</p>
          ) : null}
          <div className="mt-3 flex flex-col gap-2">
            {days.map((day) => {
              const state = states.get(day.id) ?? { kind: "idle" as const };
              const suggested = day.id === nextDay?.id && state.kind === "idle";
              return (
                <div
                  key={day.id}
                  className="reg-frame flex flex-wrap items-center gap-x-3 gap-y-2 p-3"
                  data-active={suggested ? "true" : undefined}
                >
                  <span className="w-5 shrink-0 font-mono text-xs text-foreground/30">
                    {String(day.dayIndex + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-[7rem] flex-1">
                    <p className="text-sm font-semibold leading-snug wrap-break-word">{day.name}</p>
                    <p className="text-xs text-muted">
                      {day.exercises.length} exercícios
                      <DayStatus state={state} suggested={suggested} />
                    </p>
                  </div>
                  <DayActions dayId={day.id} state={state} locked={locked} emphasize={suggested} />
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Stats grid */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {enrollment ? (
          <div className="min-w-0 reg-frame p-5">
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

        <div className="min-w-0 reg-frame p-5">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Esta semana</span>
          <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums">
            {weeklyDone}
            <span className="text-base text-muted"> / {weeklyTarget}</span>
          </p>
          <div className="mt-3 flex gap-1.5">
            {Array.from({ length: weeklyTarget }, (_, i) => (
              <span
                key={i}
                className={`h-8 flex-1 rounded-[4px] ${i < weeklyDone ? "bg-accent" : "border border-border bg-surface-2"}`}
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
                <Lettermark code="PR" className="size-5 shrink-0 text-[9px]" />
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

function InProgressBlock({
  sessionId,
  name,
  setsDone,
  startedAt,
  now,
}: {
  sessionId: string;
  name: string;
  setsDone: number;
  startedAt: Date;
  now: Date;
}) {
  const s = wallClock(startedAt, APP_TIME_ZONE);
  const n = wallClock(now, APP_TIME_ZONE);
  const sameDay = s.year === n.year && s.month === n.month && s.day === n.day;
  const started = sameDay
    ? "iniciado hoje"
    : `iniciado em ${String(s.day).padStart(2, "0")}/${String(s.month).padStart(2, "0")}`;
  return (
    <div className="relative overflow-hidden panel-raised p-6 sm:p-8">
      <span className="absolute left-0 top-0 h-full w-1.5 bg-warning" aria-hidden />
      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-warning">Treino em andamento</span>
      <h2 className="text-display mt-1.5 text-2xl font-extrabold sm:text-3xl">{name}</h2>
      <p className="mt-1.5 font-mono text-xs text-muted">
        {setsDone === 1 ? "1 série registrada" : `${setsDone} séries registradas`} · {started}
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button size="lg" asChild>
          <Link href={`/app/workout/${sessionId}`}>
            Continuar
            <GArrow className="size-4" />
          </Link>
        </Button>
        <DiscardSessionButton sessionId={sessionId} setsDone={setsDone} />
      </div>
    </div>
  );
}
