import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Play } from "lucide-react";
import { GArrow, GCheck, GLoad, Lettermark } from "@/components/ui/glyph";
import { requireUser } from "@/lib/auth/require-user";
import { getProfile } from "@/lib/data/profile";
import {
  findUndoableSwitch,
  getActiveEnrollment,
  getDaysDoneThisWeek,
  getInProgressSessions,
  getRecentPersonalRecords,
  getWeeklyProgress,
} from "@/lib/data/dashboard";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { SectionHead } from "@/components/ui/section-head";
import { DayActions, DayStatus, dayStates, exerciseCount } from "@/components/workout/day-actions";
import { InlineActionForm } from "@/components/workout/inline-action-form";
import { formatKg, plural, pluralWord } from "@/lib/utils/format";
import { listTemplates, recommendProfileOf, toCatalogItem } from "@/lib/data/templates";
import { recommendTemplates } from "@/lib/programming/recommend";
import { RecommendedPanel } from "@/components/programs/recommended-panel";
import { cn } from "@/lib/utils/cn";
import { APP_TIME_ZONE, wallClock } from "@/lib/training/week";
import { planWeek } from "@/lib/training/day-rotation";
import { formatSpDate } from "@/lib/training/stale";
import { DiscardSessionButton } from "@/components/workout/discard-session-button";
import { startAdHocWorkoutSession } from "@/lib/actions/workouts";
import { restorePreviousProgram } from "@/lib/actions/programs";
import { StaleSessionRow } from "./stale-session-row";
import { ClearParams } from "./clear-params";

export const metadata: Metadata = { title: "Hoje" };

const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
/** Exercise rows previewed in the hero: few on phones so "Iniciar treino" stays in view. */
const PREVIEW_PHONE = 3;
const PREVIEW_WIDE = 6;
/** One-time notice params, cleared from the URL once shown. */
const NOTICE_PARAMS = ["ativado", "anterior", "descartado", "salvo", "retomado"];

function greeting(hour: number) {
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

/** What each record kind is called in a PR row ("Carga · 1RM estimado"). */
const PR_TEXT: Record<string, string> = {
  MAX_WEIGHT: "Carga",
  ESTIMATED_1RM: "1RM estimado",
  MAX_REPS_AT_WEIGHT: "Repetições",
};
const PR_VALUE: Record<string, (v: number, w: number | null, r: number | null) => string> = {
  MAX_WEIGHT: (v) => formatKg(v),
  ESTIMATED_1RM: (v) => formatKg(v),
  // Bodyweight (0 kg) rep records read "15 reps", with "peso corporal" on the kinds line.
  MAX_REPS_AT_WEIGHT: (v, w, r) => (w === 0 ? plural(r ?? v, "rep", "reps") : `${formatKg(w)} × ${r ?? v}`),
};
/** The kinds line of a PR row: "1RM estimado · Repetições", "Repetições · peso corporal". */
function prKinds(pr: { kind: string; kinds: string[]; weightKg: number | null }) {
  const text = pr.kinds.map((k) => PR_TEXT[k]).filter(Boolean);
  return pr.kind === "MAX_REPS_AT_WEIGHT" && pr.weightKg === 0 ? [...text, "peso corporal"] : text;
}

export default async function TodayPage({ searchParams }: PageProps<"/app/today">) {
  const sp = await searchParams;
  const param = (key: string) => (typeof sp[key] === "string" ? sp[key] : undefined);
  const justActivated = param("ativado") === "1";
  const previousEnrollmentId = param("anterior");
  const savedSessionId = param("salvo");
  const user = await requireUser();
  const now = new Date();
  const [profile, enrollment, inProgress, weeklyCount, recentPrs] = await Promise.all([
    getProfile(user.id),
    getActiveEnrollment(user.id),
    getInProgressSessions(user.id, now),
    getWeeklyProgress(user.id),
    getRecentPersonalRecords(user.id),
  ]);
  const days = enrollment?.program.days ?? [];
  const [done, undo, saved, templates] = await Promise.all([
    enrollment
      ? getDaysDoneThisWeek(user.id, enrollment.id, days)
      : { byDayId: new Map<string, string>(), sessionCount: 0 },
    // "Voltar para …" right after a program switch (one-time, within 24 h).
    enrollment && previousEnrollmentId ? findUndoableSwitch(prisma, user.id, previousEnrollmentId, now) : null,
    // "Salvar como feito em dd/mm" lands here with the saved workout.
    savedSessionId
      ? prisma.workoutSession.findFirst({
          where: { id: savedSessionId, userId: user.id, status: "COMPLETED" },
          select: { id: true, finishedAt: true },
        })
      : null,
    // No program yet: what to start with, from the onboarding answers.
    enrollment ? null : listTemplates(),
  ]);
  const doneThisWeek = done.byDayId;

  // A workout left open on an earlier day (or for hours) and not touched
  // since is shown as a compact "não finalizado" row; it doesn't take the
  // hero or lock the day list. One with nothing on the server is an abandoned
  // start (the next start discards it): its row only appears if this device
  // still holds sets typed offline for it.
  const stale = inProgress.filter((s) => s.stale);
  const open = inProgress.filter((s) => !s.stale);

  const firstName = (profile?.displayName ?? user.name).split(" ")[0];
  // The hero suggests the next day not yet trained this week (lib/training/
  // day-rotation: the same rule the workout summary's "Próximo treino" uses to
  // promise a day for a later date). A day left open on an earlier date is
  // handled by its own row above (save it on its day, continue or discard) —
  // never suggested again next to it, which would start a second copy.
  const staleDayIds = new Set(
    [...dayStates(days, stale, new Map()).entries()].filter(([, st]) => st.kind === "in-progress").map(([id]) => id),
  );
  const plan = planWeek({
    days,
    isTrainable: (d) => d.exercises.length > 0,
    nextDayIndex: enrollment?.nextDayIndex,
    daysPerWeek: enrollment?.program.daysPerWeek ?? 0,
    doneDayIds: doneThisWeek,
    sessionCount: done.sessionCount,
    skipDayIds: staleDayIds,
  });
  const nextDay = plan.nextDay ?? undefined;
  const weekComplete = plan.weekComplete;
  // Only a workout with something logged blocks starting another day (the
  // server discards untouched open sessions when a new day starts).
  const locked = open.some((s) => s.hasData);
  // With a plan, "Esta semana" counts what the plan counts: distinct days, plus
  // repeats only where the plan repeats days (A/B at 3×) — a redo isn't a new workout.
  const hasPlan = days.some((d) => d.exercises.length > 0);
  const weeklyTarget = hasPlan ? plan.weeklyTarget : (profile?.daysPerWeek ?? 3);
  const weeklyDone = hasPlan ? plan.weeklyDone : weeklyCount;
  // Stale sessions included: their day's row continues that session instead
  // of offering a fresh "Iniciar".
  const states = dayStates(days, [...open, ...stale], doneThisWeek);
  const wall = wallClock(now, APP_TIME_ZONE);
  const dateStr = `${WEEKDAYS[wall.weekday]} · ${String(wall.day).padStart(2, "0")} ${MONTHS[wall.month - 1]}`;
  const editHref = enrollment ? `/app/programs/${enrollment.programId}/edit` : "/app/programs";
  const answers = recommendProfileOf(profile);
  const picks =
    templates && answers
      ? recommendTemplates(answers, templates.map(toCatalogItem))
          .slice(0, 3)
          .map((r) => ({
            slug: r.template.slug,
            namePt: r.template.namePt,
            taglinePt: r.template.taglinePt,
            reasons: r.reasons,
          }))
      : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <ClearParams keys={NOTICE_PARAMS} />
      {/* Masthead */}
      <div className="flex items-baseline justify-between">
        <div>
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-muted">{dateStr}</span>
          <h1 className="text-display mt-1 text-3xl font-extrabold sm:text-4xl">
            {greeting(wall.hour)}, {firstName}.
          </h1>
        </div>
      </div>

      {/* One-time outcome notices (the params are cleared once shown) */}
      {param("descartado") === "1" ? <Notice>Treino descartado.</Notice> : null}
      {saved?.finishedAt ? (
        <Notice>
          <span>Treino de {formatSpDate(saved.finishedAt)} salvo no histórico.</span>
          <Link href={`/app/workout/${saved.id}/summary`} className="inline-flex items-center gap-1 text-accent">
            Ver
            <GArrow className="size-3" />
          </Link>
        </Notice>
      ) : null}
      {param("retomado") === "1" && enrollment ? (
        <Notice>
          {enrollment.program.name} retomado · semana {enrollment.currentWeek}
        </Notice>
      ) : null}
      {undo ? (
        <div className="mt-6 border-l-2 border-l-accent bg-surface-2 px-3 py-2.5">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em]">Programa trocado</p>
          <p className="mt-0.5 text-xs text-muted">
            {undo.previous.program.name} continua na semana {undo.previous.currentWeek}
            {undo.previous.program.durationWeeks ? ` de ${undo.previous.program.durationWeeks}` : ""}, de onde você
            parou.
          </p>
          <InlineActionForm
            action={restorePreviousProgram.bind(null, undo.previous.id)}
            failText="Não foi possível voltar. Tente de novo."
            className="mt-2"
            errorClassName="mt-1.5"
          >
            <SubmitButton size="sm" variant="outline" pendingLabel="Voltando…">
              Voltar para {undo.previous.program.name}
            </SubmitButton>
          </InlineActionForm>
        </div>
      ) : null}

      {/* Focus block */}
      <div className="mt-8 flex flex-col gap-3">
        {stale.map((session) => (
          <StaleSessionRow
            key={session.id}
            sessionId={session.id}
            name={session.name}
            setsDone={session.registered}
            onServer={session.hasData}
            dayLabel={formatSpDate(session.saveAs.finishedAt)}
          />
        ))}
        {open.length > 0 ? (
          open.map((session) => (
            <InProgressBlock
              key={session.id}
              sessionId={session.id}
              name={session.name}
              setsDone={session.registered}
              startedAt={session.startedAt}
              now={now}
            />
          ))
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
                  <span className="font-bold text-foreground">{nextDay.exercises.length}</span>{" "}
                  {nextDay.exercises.length === 1 ? "exercício" : "exercícios"}
                </span>
                {nextDay.estimatedMinutes ? (
                  <span>
                    ~<span className="font-bold text-foreground">{nextDay.estimatedMinutes}</span>′
                  </span>
                ) : null}
              </div>

              {/* The daily loop is "open → start": the button sits right under the title. */}
              <InlineActionForm
                action={startAdHocWorkoutSession.bind(null, nextDay.id)}
                failText="Não foi possível iniciar o treino. Tente de novo."
                className="mt-5"
                errorClassName="mt-2"
              >
                <SubmitButton size="lg" variant="strong" className="w-full sm:w-auto" pendingLabel="Iniciando…">
                  <Play className="size-4" />
                  Iniciar treino
                </SubmitButton>
              </InlineActionForm>

              {/* Exercise preview — each row opens its technique page */}
              <ol className="mt-5 flex flex-col border-b border-border">
                {nextDay.exercises.slice(0, PREVIEW_WIDE).map((ex, i) => (
                  <li key={ex.id} className={cn("border-t border-border", i >= PREVIEW_PHONE && "hidden sm:block")}>
                    <Link href={`/app/exercises/${ex.exercise.slug}`} className="group flex items-center gap-3 py-2">
                      <div className="relative size-10 shrink-0 overflow-hidden rounded-[3px] bg-surface-2">
                        {ex.exercise.media?.[0]?.url ? (
                          <Image src={ex.exercise.media[0].url} alt="" fill sizes="40px" className="object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-muted">
                            <GLoad className="size-4" />
                          </div>
                        )}
                      </div>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium group-hover:text-accent">
                        {ex.exercise.namePt}
                      </span>
                      <GArrow className="size-3.5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
                {nextDay.exercises.length > PREVIEW_PHONE ? (
                  <li
                    className={cn(
                      "border-t border-border py-2 pl-[52px] text-xs text-muted",
                      nextDay.exercises.length <= PREVIEW_WIDE && "sm:hidden",
                    )}
                  >
                    <span className="sm:hidden">
                      +{plural(nextDay.exercises.length - PREVIEW_PHONE, "exercício", "exercícios")}
                    </span>
                    <span className="hidden sm:inline">
                      +{plural(nextDay.exercises.length - PREVIEW_WIDE, "exercício", "exercícios")}
                    </span>
                  </li>
                ) : null}
              </ol>
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
        ) : enrollment && hasPlan ? (
          // Every day with exercises is left open: the rows above save, continue or discard them.
          <p className="px-1 text-sm text-muted">
            Salve ou descarte {stale.length === 1 ? "o treino não finalizado" : "os treinos não finalizados"} para seguir o
            programa.
          </p>
        ) : enrollment ? (
          <div className="border-y-2 border-y-[var(--rule-heavy)] bg-surface-2 p-8 text-center">
            <p className="text-display text-2xl font-bold">Programa sem exercícios.</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
              {enrollment.program.name} ainda não tem nada para treinar. Adicione ao menos um exercício, ou escolha um
              programa pronto.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button variant="strong" asChild>
                <Link href={editHref}>Adicionar exercícios</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/app/programs">Explorar programas</Link>
              </Button>
            </div>
          </div>
        ) : picks.length > 0 ? (
          // No program yet: the onboarding answers pay off — one pick, why, and one tap to the first set.
          <RecommendedPanel picks={picks} fatLoss={answers?.goal === "FAT_LOSS"} showLinks />
        ) : (
          <div className="border-y-2 border-y-[var(--rule-heavy)] bg-surface-2 p-8 text-center">
            <p className="text-display text-2xl font-bold">Sem programa ativo.</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
              Escolha um programa pronto ou monte o seu para começar a treinar.
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
          <SectionHead label="Treinos do programa" count={plural(days.length, "dia", "dias")} />
          {locked ? (
            <p className="mt-2 text-xs text-muted">Finalize ou descarte o treino em andamento para iniciar outro dia.</p>
          ) : null}
          <div className="mt-3 flex flex-col gap-2">
            {days.map((day) => {
              const state = states.get(day.id) ?? { kind: "idle" as const };
              const suggested = day.id === nextDay?.id && state.kind === "idle";
              const empty = day.exercises.length === 0;
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
                      {exerciseCount(day.exercises.length)}
                      <DayStatus state={state} suggested={suggested} />
                    </p>
                  </div>
                  <DayActions
                    dayId={day.id}
                    state={state}
                    locked={locked}
                    emphasize={suggested}
                    editHref={empty ? editHref : undefined}
                  />
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
                <span className="mt-1.5 block text-[10px] uppercase tracking-wider text-muted">
                  {pluralWord(enrollment.program.durationWeeks, "semana", "semanas")}
                </span>
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
          <div className="mt-1.5 flex items-center justify-between gap-3">
            <span className="text-[10px] uppercase tracking-wider text-muted">treinos concluídos</span>
            {/* Every past workout and the calendar live in the history. */}
            <Link
              href="/app/history"
              className="-my-2.5 inline-flex items-center gap-1 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-accent hover:underline"
            >
              Histórico
              <GArrow className="size-3" />
            </Link>
          </div>
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
                  <p className="truncate text-[11px] uppercase tracking-wider text-muted">
                    {prKinds(pr).join(" · ")}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-lg font-bold tabular-nums">
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

/** A one-time mono status line (discarded, saved, restored). */
function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 border-l-2 border-l-accent bg-surface-2 px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em]"
    >
      {children}
    </p>
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
        {plural(setsDone, "série registrada", "séries registradas")} · {started}
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
