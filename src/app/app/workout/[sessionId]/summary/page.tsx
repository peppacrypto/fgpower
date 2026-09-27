import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Play } from "lucide-react";
import { GArrow } from "@/components/ui/glyph";
import { requireUser } from "@/lib/auth/require-user";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { SectionHead } from "@/components/ui/section-head";
import { InlineActionForm } from "@/components/workout/inline-action-form";
import { startAdHocWorkoutSession } from "@/lib/actions/workouts";
import { describeRecord, type RecordLike } from "@/lib/training/personal-records-core";
import { adviceInSeconds, formatSet, isTimedHold } from "@/lib/training/set-plan";
import { formatDuration, formatKg, formatNumber, formatVolume, plural } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { formatDayNumber, formatSpShortDate, type LastTimeDelta } from "./dossier";
import { loadWorkoutSummary, type WorkoutSummary } from "./summary-data";
import { ShareWorkoutForm } from "./share-workout-form";

export const metadata: Metadata = { title: "Resumo do treino" };

/** Mono micro-caps: the dossier's field labels. */
const FIELD = "font-mono text-[10px] font-bold uppercase tracking-[0.16em]";

/**
 * The "dossiê do treino": saved confirmation, the dated masthead, who sees it,
 * records (or the baseline on a first time), each exercise vs. last time and
 * what to aim for next, and — for the latest workout — the week and the next
 * workout with a strong way into it.
 */
export default async function WorkoutSummaryPage({ params }: PageProps<"/app/workout/[sessionId]/summary">) {
  const { sessionId } = await params;
  const user = await requireUser();

  const data = await loadWorkoutSummary(user.id, sessionId);
  if (!data) notFound();
  // Not finished: it isn't in the history yet — never say "salvo" about it.
  if (data.status === "IN_PROGRESS") redirect(`/app/workout/${sessionId}`);
  if (data.status !== "COMPLETED") notFound();

  // `next` is only there for the latest workout (see loadWorkoutSummary).
  const { session, ordinal, exercises, recordGroups, allBaseline, share, next } = data;
  const week =
    session.programWeek != null
      ? session.durationWeeks != null && session.programWeek <= session.durationWeeks
        ? `Semana ${session.programWeek}/${session.durationWeeks}`
        : `Semana ${session.programWeek}`
      : null;
  // A hold's records are in seconds ("Prancha · 50 s"), as its rows are.
  const shownRecordGroups = recordGroups
    .map((g) => {
      const timed = g.slug ? isTimedHold({ slug: g.slug }) : false;
      const parts = g.records.map((r) => (timed ? describeHoldRecord(r) : describeRecord(r))).filter((t) => t !== null);
      return { ...g, text: parts.join(" · ") };
    })
    .filter((g) => g.text !== "");
  const stats = [
    session.durationSeconds ? formatDuration(session.durationSeconds) : null,
    plural(session.totalWorkingSets, "série de trabalho", "séries de trabalho"),
    session.totalVolumeKg ? `${formatVolume(session.totalVolumeKg)} de volume` : null,
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      {/* Masthead */}
      <p className={cn(FIELD, "flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] tracking-[0.14em] text-success")}>
        <span>Treino concluído</span>
        <span aria-hidden className="text-muted">
          ·
        </span>
        <span>Salvo no histórico ✓</span>
      </p>
      <p className={cn(FIELD, "mt-3 text-muted")}>
        Treino nº {ordinal} · {formatSpShortDate(session.finishedAt)}
        {week ? ` · ${week}` : ""}
      </p>
      <h1 className="text-display mt-1.5 text-3xl font-extrabold tracking-tight sm:text-4xl">{session.name}</h1>
      <p className="mt-2 text-sm tabular-nums text-muted">{stats.join(" · ")}</p>
      {ordinal === 1 && next ? <p className="mt-3 text-sm">{firstSessionLine(exercises)}</p> : null}

      {/* Who sees it — near the top, compact; the workout itself is already saved. */}
      <section aria-label="Compartilhar treino" className="mt-5 border-y border-border py-3">
        <ShareWorkoutForm sessionId={session.id} initial={share.initial} published={share.published} />
      </section>

      {/* Records: one card per exercise, in workout order — or the baseline. */}
      {shownRecordGroups.length > 0 ? (
        <section className="mt-7">
          <SectionHead label="Recordes" count={plural(shownRecordGroups.length, "exercício", "exercícios")} />
          <div className="mt-3 flex flex-col gap-2">
            {shownRecordGroups.map((g) => (
              <Link
                key={g.exerciseId}
                href={g.slug ? `/app/exercises/${g.slug}/history` : "/app/progress"}
                className="group flex items-center gap-3 border-l-4 border-l-accent-strong bg-accent-soft py-3 pl-4 pr-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{g.name}</p>
                  <p className="mt-0.5 text-xs text-foreground/80">{g.text}</p>
                </div>
                <span className="tag tag--mark shrink-0">PR</span>
                <GArrow className="size-3.5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </section>
      ) : allBaseline ? (
        <section className="mt-7 border-l-2 border-l-accent bg-surface-2 px-3 py-2.5">
          <p className={cn(FIELD, "text-[11px] tracking-[0.14em]")}>
            Marca inicial · {plural(exercises.length, "exercício registrado", "exercícios registrados")}
          </p>
          <p className="mt-0.5 text-xs text-muted">A partir do próximo treino, cada recorde aparece aqui.</p>
        </section>
      ) : null}

      {/* Each exercise: what was done, vs. last time, and what to aim for next. */}
      <section className="mt-7">
        <SectionHead label="Exercícios" count={exercises.length} />
        <div className="mt-3 flex flex-col gap-2">
          {exercises.map((ex, i) => (
            <div key={ex.logId} className="reg-frame p-4">
              <div className="flex items-baseline gap-3">
                <span className="w-5 shrink-0 font-mono text-xs text-foreground/30">{String(i + 1).padStart(2, "0")}</span>
                <p className="min-w-0 flex-1 text-sm font-semibold">{ex.name}</p>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 pl-8 font-mono text-sm tabular-nums text-muted">
                {ex.sets.map((s) => (
                  <span key={s.id} className={s.isExtra ? "text-foreground/70" : undefined}>
                    {s.isExtra ? <span className="mr-1 text-[10px] font-bold uppercase text-warning">extra</span> : null}
                    {formatSet(s.weightKg, s.reps, { timed: isTimedHold({ slug: ex.slug }) })}
                  </span>
                ))}
              </div>
              {/* Label over value on phones (the value gets the full width); side by side from sm. */}
              <dl className="mt-3 grid grid-cols-1 gap-y-0.5 pl-8 sm:grid-cols-[auto_1fr] sm:items-baseline sm:gap-x-3 sm:gap-y-2">
                <dt className={cn(FIELD, "text-muted")}>Vs. última vez</dt>
                <dd className="min-w-0">
                  <DeltaChip
                    delta={ex.delta}
                    timed={isTimedHold({ slug: ex.slug })}
                    noLoad={ex.sets.every((s) => s.weightKg === 0)}
                  />
                  {ex.previousText && ex.delta.kind !== "first" ? (
                    <span className="mt-0.5 block font-mono text-[11px] text-muted">
                      {ex.previousAt ? `${formatSpShortDate(ex.previousAt)}: ` : "antes: "}
                      {withoutZeroLoad(ex.previousText, isTimedHold({ slug: ex.slug }))}
                    </span>
                  ) : null}
                </dd>
                {ex.advice ? (
                  <NextAdvice advice={isTimedHold({ slug: ex.slug }) ? adviceInSeconds(ex.advice) : ex.advice} />
                ) : null}
              </dl>
            </div>
          ))}
        </div>
      </section>

      {next ? <NextUp next={next} /> : <ArchiveExit />}
    </div>
  );
}

/** "Na próxima": the advice the workout screen will give next time. */
function NextAdvice({ advice }: { advice: NonNullable<WorkoutSummary["exercises"][number]["advice"]> }) {
  return (
    <>
      <dt className={cn(FIELD, "mt-2 text-muted sm:mt-0")}>Na próxima</dt>
      <dd className="min-w-0">
        <span className={cn("font-mono text-xs font-bold", advice.kind === "increase" ? "text-accent" : "text-foreground")}>
          {advice.headline}
        </span>
        <span className="mt-0.5 block text-[11px] text-muted">{advice.reason}</span>
      </dd>
    </>
  );
}

/**
 * The line under a first workout's masthead: the loads are what the next one
 * suggests — or, with no load anywhere (all bodyweight), today's reps / times
 * are what it measures against.
 */
function firstSessionLine(exercises: WorkoutSummary["exercises"]) {
  const loaded = exercises.some((ex) => ex.sets.some((s) => (s.weightKg ?? 0) > 0));
  if (loaded) return "Primeira sessão registrada. Na próxima, sugerimos suas cargas.";
  const timed = exercises.filter((ex) => isTimedHold({ slug: ex.slug })).length;
  const what = timed === 0 ? "suas reps" : timed === exercises.length ? "seus tempos" : "suas reps e tempos";
  // "a referência." wraps as one piece: never a lone last word.
  return `Primeira sessão registrada. Na próxima, ${what} de hoje viram a\u00a0referência.`;
}

/**
 * A hold's record in seconds: "50 s" (bodyweight), "30 s com 10 kg". A load
 * record stays as it is; an e1RM from seconds means nothing, so none.
 */
function describeHoldRecord(r: RecordLike): string | null {
  const nbsp = "\u00a0";
  switch (r.kind) {
    case "MAX_REPS_AT_WEIGHT": {
      const secs = r.reps ?? r.value;
      if (secs == null) return "recorde de tempo";
      return r.weightKg ? `${secs}${nbsp}s com ${formatKg(r.weightKg)}` : `${secs}${nbsp}s`;
    }
    case "ESTIMATED_1RM":
      return null;
    default:
      return describeRecord(r);
  }
}

const ZERO_LOAD = `${formatKg(0)} × `;

/**
 * Last time's sets as dossier.ts setsText groups them ("40 kg × 12, 10 ·
 * 42,5 kg × 8"), with a group done without load printed the way formatSet
 * prints a bodyweight set: "× 12, 12" — never "0 kg × 12" — and a hold's
 * numbers in seconds: "45, 40 s", "10 kg × 30, 25 s".
 */
function withoutZeroLoad(text: string, timed: boolean) {
  return text
    .split(" · ")
    .map((group) => {
      if (!group.startsWith(ZERO_LOAD)) return timed ? `${group}\u00a0s` : group;
      const reps = group.slice(ZERO_LOAD.length);
      return timed ? `${reps}\u00a0s` : `×\u00a0${reps}`;
    })
    .join(" · ");
}

/**
 * ↑ carga +2,5 kg / ↑ reps +6 / = mesma carga e reps / 1ª vez — gains in
 * green, the rest muted. A different number of sets at the top load is said
 * next to it: "1 de 2 séries" (fewer), "+1 série" (more).
 */
function DeltaChip({
  delta,
  timed = false,
  noLoad = false,
}: {
  delta: LastTimeDelta;
  /** A hold: its reps are seconds ("↑ tempo +5 s"). */
  timed?: boolean;
  /** Done without load (bodyweight): only the reps (or the time) compare. */
  noLoad?: boolean;
}) {
  const base = "font-mono text-xs font-bold tabular-nums";
  const repsDelta = (sign: string, n: number) =>
    timed ? `tempo ${sign}${formatNumber(n, 0)}\u00a0s` : `reps ${sign}${formatNumber(n, 0)}`;
  switch (delta.kind) {
    case "first":
      return <span className={cn(base, "text-muted")}>1ª vez · marca inicial</span>;
    case "same":
      return (
        <span className={cn(base, "text-muted")}>
          {noLoad ? (timed ? "= mesmo tempo" : "= mesmas reps") : timed ? "= mesma carga e tempo" : "= mesma carga e reps"}
        </span>
      );
    case "load":
      return delta.direction === "up" ? (
        <span className={cn(base, "text-success")}>↑ carga +{formatKg(delta.deltaKg)}</span>
      ) : (
        <span className={cn(base, "text-muted")}>↓ carga −{formatKg(delta.deltaKg)}</span>
      );
    case "reps":
      return (
        <span className={base}>
          {delta.direction === "up" ? (
            <span className="text-success">↑ {repsDelta("+", delta.deltaReps)}</span>
          ) : (
            <span className="text-muted">↓ {repsDelta("−", delta.deltaReps)}</span>
          )}
          {delta.sets ? (
            <>
              <span className="text-muted"> · </span>
              <SetCount sets={delta.sets} />
            </>
          ) : null}
        </span>
      );
    case "sets":
      return (
        <span className={base}>
          {delta.direction === "up" ? <span className="text-success">↑ </span> : null}
          <SetCount sets={delta.sets} />
        </span>
      );
  }
}

/** Sets at the top load vs. last time: "1 de 2 séries" (muted) / "+1 série" (green). */
function SetCount({ sets }: { sets: { now: number; before: number } }) {
  return sets.now < sets.before ? (
    <span className="text-muted">
      {formatNumber(sets.now, 0)} de {plural(sets.before, "série", "séries")}
    </span>
  ) : (
    <span className="text-success">+{plural(sets.now - sets.before, "série", "séries")}</span>
  );
}

/** This week and the next workout, for the latest finished workout. */
function NextUp({ next }: { next: NonNullable<WorkoutSummary["next"]> }) {
  const { day, date, week, weekComplete } = next;
  const when = date
    ? date.isToday
      ? "hoje"
      : date.isTomorrow
        ? `amanhã, ${formatDayNumber(date.dayNo)}`
        : formatDayNumber(date.dayNo)
    : null;
  return (
    <section className="relative mt-8 overflow-hidden panel-raised">
      <span className="absolute left-0 top-0 h-full w-1.5 bg-accent" aria-hidden />
      <div className="p-5 pl-6 sm:p-7 sm:pl-8">
        {week ? (
          <div className="mb-5">
            <div className="flex items-baseline justify-between gap-3">
              <span className={cn(FIELD, "text-muted")}>{weekComplete ? "Semana concluída ✓" : "Esta semana"}</span>
              <span className="font-mono text-sm font-bold tabular-nums">
                {week.done}
                <span className="text-muted">/{week.target}</span>
              </span>
            </div>
            <div className="mt-2 flex gap-1.5" aria-hidden>
              {Array.from({ length: Math.max(1, week.target) }, (_, i) => (
                <span
                  key={i}
                  className={cn("h-2 flex-1", i < week.done ? "bg-accent" : "border border-border bg-surface")}
                />
              ))}
            </div>
            {week.streak >= 2 ? (
              <p className={cn(FIELD, "mt-2 text-success")}>
                {plural(week.streak, "semana seguida", "semanas seguidas")} com treino
              </p>
            ) : null}
          </div>
        ) : null}

        {day ? (
          <>
            <p className={cn(FIELD, "flex flex-wrap gap-x-2 text-[11px] tracking-[0.14em] text-accent")}>
              <span>Próximo treino</span>
              {when ? (
                <>
                  <span aria-hidden>·</span>
                  <span className="whitespace-nowrap">{when}</span>
                </>
              ) : null}
            </p>
            <h2 className="text-display mt-1.5 text-2xl font-extrabold sm:text-3xl">{day.name}</h2>
            <p className="mt-1 font-mono text-xs text-muted">
              {plural(day.exerciseCount, "exercício", "exercícios")}
              {day.estimatedMinutes ? ` · ~${formatDuration(day.estimatedMinutes * 60)}` : ""}
              {date && !date.isToday ? " · data sugerida" : ""}
            </p>
            {date?.isToday ? (
              <InlineActionForm
                action={startAdHocWorkoutSession.bind(null, day.id)}
                failText="Não foi possível iniciar o treino. Tente de novo."
                className="mt-4"
                errorClassName="mt-2"
              >
                <SubmitButton size="lg" variant="strong" className="w-full sm:w-auto" pendingLabel="Iniciando…">
                  <Play className="size-4" />
                  Iniciar treino
                </SubmitButton>
              </InlineActionForm>
            ) : (
              <Button size="lg" variant="strong" className="mt-4 w-full sm:w-auto" asChild>
                <Link href="/app/today">
                  Ir para Hoje
                  <GArrow className="size-4" />
                </Link>
              </Button>
            )}
          </>
        ) : (
          <>
            <span className={cn(FIELD, "block text-[11px] tracking-[0.18em] text-accent")}>Próximo passo</span>
            <p className="mt-1.5 text-sm text-muted">
              {next.openDaysBlocking > 0
                ? `${next.openDaysBlocking === 1 ? "Há um treino não finalizado" : "Há treinos não finalizados"}. Salve ou descarte em Hoje para seguir o programa.`
                : next.programName
                  ? `${next.programName} não tem outro dia com exercícios.`
                  : "Com um programa ativo, o app sugere o próximo treino e as cargas."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="lg" variant="strong" asChild>
                <Link href="/app/today">
                  Ir para Hoje
                  <GArrow className="size-4" />
                </Link>
              </Button>
              {!next.programName ? (
                <Button size="lg" variant="outline" asChild>
                  <Link href="/app/programs">Explorar programas</Link>
                </Button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/** A past workout opened from the history: back where the user came from. */
function ArchiveExit() {
  return (
    <div className="mt-8 flex flex-wrap gap-2">
      <Button variant="outline" asChild>
        <Link href="/app/history">Ver histórico</Link>
      </Button>
      <Button variant="ghost" asChild>
        <Link href="/app/today">Ir para Hoje</Link>
      </Button>
    </div>
  );
}
