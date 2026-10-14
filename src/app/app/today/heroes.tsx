import Link from "next/link";
import Image from "next/image";
import { Play, RotateCcw } from "lucide-react";
import { GArrow, GCheck, GLoad } from "@/components/ui/glyph";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { InlineActionForm } from "@/components/workout/inline-action-form";
import { DiscardSessionButton } from "@/components/workout/discard-session-button";
import { startAdHocWorkoutSession } from "@/lib/actions/workouts";
import { repeatBlock, startNextBlock } from "@/lib/actions/programs";
import type { CompletedBlock } from "@/lib/data/program-lifecycle";
import { dayNameWithoutWeekday, formatDayTag, scheduleShifted, whenText } from "@/lib/training/day-rotation";
import { APP_TIME_ZONE, wallClock } from "@/lib/training/week";
import { formatKg, plural, pluralWord } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { deriveGroups, groupRule } from "@/lib/programming/groups";
import { chooseWeekStart } from "./actions";
import type { WeekStartPick } from "./week-start";

/** Exercise rows previewed in the hero: few on phones so "Iniciar treino" stays in view. */
const PREVIEW_PHONE = 3;
const PREVIEW_WIDE = 6;

export interface HeroDay {
  id: string;
  name: string;
  estimatedMinutes: number | null;
  /** In order; `groupKey` marks supersets and circuits (lib/programming/groups). */
  exercises: { id: string; groupKey?: string | null; exercise: { namePt: string; slug: string; media?: { url: string }[] } }[];
}

/** "Sex · 16 out" — a day tag (lib/training/day-rotation formatDayTag) in sentence case. */
export function dayTag(dayNo: number): string {
  const tag = formatDayTag(dayNo).toLowerCase();
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}

/** "8 exercícios · ~55 min" under a day's name. */
function DayMeta({ day, className }: { day: HeroDay; className?: string }) {
  return (
    <p className={cn("flex flex-wrap items-center gap-x-2 text-[15px] tabular-nums text-muted", className)}>
      <span className="whitespace-nowrap">
        <span className="font-semibold text-foreground">{day.exercises.length}</span>{" "}
        {pluralWord(day.exercises.length, "exercício", "exercícios")}
      </span>
      {day.estimatedMinutes ? (
        <>
          <span aria-hidden>·</span>
          <span className="whitespace-nowrap">
            ~<span className="font-semibold text-foreground">{day.estimatedMinutes}</span> min
          </span>
        </>
      ) : null}
    </p>
  );
}

/** "Sugerido para Seg · 28 set" — or "Sugerido para amanhã · Ter · 29 set"; each part wraps as a whole. */
function SuggestedTag({ dayNo, todayNo }: { dayNo: number; todayNo: number }) {
  return (
    <span className="tag tag--spec flex-wrap gap-x-[0.4em] gap-y-0.5 text-[13px] leading-tight">
      <span className="whitespace-nowrap">Sugerido para{dayNo === todayNo + 1 ? " amanhã ·" : ""}</span>{" "}
      <span className="whitespace-nowrap">{dayTag(dayNo)}</span>
    </span>
  );
}

/**
 * The next workout: what to train today, one tap from the first set — the
 * largest thing on Today, with its one filled action.
 * `position` is "Dia 2 de 5" (the day's place among the plan's days);
 * `weekStart` the choice after a week that stopped mid-plan (W-089).
 */
export function NextWorkoutHero({
  day,
  shifted = false,
  justActivated,
  position,
  plannedToday,
  weekStart,
}: {
  day: HeroDay;
  /** A-076: the day is named after a weekday but suggested on another — show it without that weekday. */
  shifted?: boolean;
  justActivated: boolean;
  position: { n: number; of: number } | null;
  /** Today is one of the user's training days: "Sugerido para hoje (sexta)". */
  plannedToday: string | null;
  weekStart: {
    leftover: string[];
    /** Last week was the entry week: its days left over are no miss. */
    afterEntryWeek: boolean;
    pick: WeekStartPick;
    firstDayName: string;
    enrollmentId: string;
    weekKey: string;
  } | null;
}) {
  // Supersets (W-104), as the program page names them: the group's rule over its first
  // member, then "A1", "A2" before each name.
  const slots = deriveGroups(day.exercises.map((ex) => ({ groupKey: ex.groupKey ?? null })));
  return (
    <div className="panel" data-hero="next">
      <div className="p-5 sm:p-7">
        {justActivated ? (
          <span className="tag tag--mark mb-3">
            <GCheck className="size-3.5" />
            Programa ativado
          </span>
        ) : null}
        <div className="flex items-baseline justify-between gap-3">
          <span className="eyebrow text-accent">Próximo treino</span>
          {position ? (
            <span className="shrink-0 text-[13px] tabular-nums text-muted">
              Dia {position.n} de {position.of}
            </span>
          ) : null}
        </div>
        <h2 className="text-display mt-1 text-[1.875rem] font-bold leading-tight wrap-break-word sm:text-[2.25rem]">
          {shifted ? dayNameWithoutWeekday(day.name) : day.name}
        </h2>
        <DayMeta day={day} className="mt-2" />
        {plannedToday ? <p className="mt-1 text-[13px] text-muted">Sugerido para hoje ({plannedToday})</p> : null}

        {/* The daily loop is "open → start": the button sits right under the title. */}
        <InlineActionForm
          action={startAdHocWorkoutSession.bind(null, day.id)}
          failText="Não foi possível iniciar o treino. Tente de novo."
          className="mt-5"
          errorClassName="mt-2"
        >
          <SubmitButton size="lg" variant="strong" className="w-full sm:w-auto sm:min-w-56" pendingLabel="Iniciando…">
            <Play className="size-4" />
            Iniciar treino
          </SubmitButton>
        </InlineActionForm>

        {/* Exercise preview — each row opens its technique page */}
        <ol className="mt-6 flex flex-col divide-y divide-border border-t border-border">
          {day.exercises.slice(0, PREVIEW_WIDE).map((ex, i) => {
            const slot = slots[i];
            return (
              <li key={ex.id} data-group={slot?.label} className={cn(i >= PREVIEW_PHONE && "hidden sm:block")}>
                {slot?.first ? <p className="pt-2.5 text-[13px] font-medium text-accent">{groupRule(slot)}</p> : null}
                <Link href={`/app/exercises/${ex.exercise.slug}`} className="group flex items-center gap-3 py-2.5">
                  <div className="relative size-11 shrink-0 overflow-hidden rounded-[var(--radius-md)] bg-surface-2">
                    {ex.exercise.media?.[0]?.url ? (
                      <Image src={ex.exercise.media[0].url} alt="" fill sizes="44px" className="object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted">
                        <GLoad className="size-4" />
                      </div>
                    )}
                  </div>
                  <span className="line-clamp-2 min-w-0 flex-1 text-[15px] font-medium leading-snug wrap-break-word group-hover:text-accent">
                    {slot ? (
                      <span className="mr-1.5 inline-flex rounded-[var(--radius-sm)] bg-accent-soft px-1.5 text-[13px] font-semibold tabular-nums text-accent">
                        <span aria-hidden>{slot.label}</span>
                        {/* The space is spoken too: "Superset A, 1 de 2: Supino…". */}
                        <span className="sr-only">{`${slot.heading}, ${slot.position} de ${slot.size}: `}</span>
                      </span>
                    ) : null}
                    {ex.exercise.namePt}
                  </span>
                  <GArrow className="size-3.5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            );
          })}
          {day.exercises.length > PREVIEW_PHONE ? (
            <li
              className={cn("py-2.5 pl-14 text-[13px] text-muted", day.exercises.length <= PREVIEW_WIDE && "sm:hidden")}
            >
              <span className="sm:hidden">+{plural(day.exercises.length - PREVIEW_PHONE, "exercício", "exercícios")}</span>
              <span className="hidden sm:inline">
                +{plural(day.exercises.length - PREVIEW_WIDE, "exercício", "exercícios")}
              </span>
            </li>
          ) : null}
        </ol>

        {weekStart ? <WeekStartChoice {...weekStart} /> : null}
      </div>
    </div>
  );
}

/**
 * A new week after one that stopped mid-plan: which days were left, and the
 * two ways to go on — the hero above already shows the one picked.
 */
function WeekStartChoice({
  leftover,
  afterEntryWeek,
  pick,
  firstDayName,
  enrollmentId,
  weekKey,
}: {
  leftover: string[];
  afterEntryWeek: boolean;
  pick: WeekStartPick;
  firstDayName: string;
  enrollmentId: string;
  weekKey: string;
}) {
  // Two equal halves, 44px+ tall (a thumb at the gym): a label that wraps grows the button, never spills.
  const option = (value: WeekStartPick, label: string) => (
    <InlineActionForm
      action={chooseWeekStart.bind(null, enrollmentId, weekKey, value)}
      failText="Não foi possível mudar. Tente de novo."
      className="min-w-0 flex-1"
      errorClassName="mt-1"
    >
      <SubmitButton
        variant={pick === value ? "primary" : "outline"}
        aria-pressed={pick === value}
        className="h-auto min-h-11 w-full whitespace-normal px-3 py-2 text-center leading-tight"
      >
        {label}
      </SubmitButton>
    </InlineActionForm>
  );
  return (
    <div className="mt-5 border-t border-border pt-4" data-week-start>
      <p className="text-[13px] font-medium text-muted">
        {afterEntryWeek ? "Da semana de entrada" : "Da semana passada"} {leftover.length === 1 ? "ficou" : "ficaram"}
      </p>
      <ul className="mt-1 flex flex-col gap-0.5 text-[15px] font-medium">
        {leftover.map((name) => (
          <li key={name} className="wrap-break-word">
            {name}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        {option("continue", "Continuar a sequência")}
        {option("restart", `Recomeçar: ${firstDayName.split(/\s+[—-]\s+/)[0]}`)}
      </div>
    </div>
  );
}

/**
 * Nothing to train today: a workout is done today, or today is a rest day in
 * the user's week. What's next and when — with "Treinar mesmo assim" for a
 * day the user wants to train anyway (the next day of this week's plan).
 */
export function RestDayHero({
  next,
  todayNo,
  trainedToday,
  todaySessionId,
  startDay,
}: {
  next: { day: HeroDay; dayNo: number };
  todayNo: number;
  trainedToday: boolean;
  todaySessionId: string | null;
  /** The day "Treinar mesmo assim" opens (this week's next); null when none is left this week. */
  startDay: { id: string; name: string } | null;
}) {
  return (
    <div className="panel p-5 sm:p-7" data-hero="rest">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <span className="text-[15px] font-semibold">Descanso hoje</span>
        {trainedToday ? (
          <span className="tag tag--mark">
            <GCheck className="size-3.5" />
            Treino de hoje feito
          </span>
        ) : null}
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <span className="eyebrow text-accent">Próximo treino</span>
        <h2 className="text-display mt-1 text-[1.5rem] font-semibold leading-tight wrap-break-word sm:text-[1.75rem]">
          {scheduleShifted({ dayName: next.day.name, dayNo: next.dayNo }) ? dayNameWithoutWeekday(next.day.name) : next.day.name}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
          <SuggestedTag dayNo={next.dayNo} todayNo={todayNo} />
          <DayMeta day={next.day} />
        </div>
        <span className="sr-only"> ({whenText(next.dayNo, todayNo)})</span>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        {startDay ? (
          <InlineActionForm
            action={startAdHocWorkoutSession.bind(null, startDay.id)}
            failText="Não foi possível iniciar o treino. Tente de novo."
            errorClassName="mt-2"
          >
            <SubmitButton variant="outline" pendingLabel="Iniciando…">
              <Play className="size-4" />
              Treinar mesmo assim
            </SubmitButton>
          </InlineActionForm>
        ) : null}
        {todaySessionId ? (
          <Link
            href={`/app/workout/${todaySessionId}/summary`}
            className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent hover:underline"
          >
            Ver treino de hoje
            <GArrow className="size-3.5" />
          </Link>
        ) : null}
      </div>
      {startDay && startDay.id !== next.day.id ? (
        <p className="mt-2 text-[13px] text-muted">Treinar mesmo assim abre {startDay.name}, o próximo desta semana.</p>
      ) : null}
    </div>
  );
}

/**
 * Every workout of the week is done — and when the next week starts.
 * `kind`: a full week, a program's entry week (its short target met), or the
 * entry week of a program started in a week that already counted through
 * another one ("counted": the block just finished, the program switched
 * from) — nothing more is asked of it; the program starts next week.
 */
export function WeekCompleteHero({
  next,
  todayNo,
  kind,
  programName = null,
}: {
  next: { day: { name: string }; dayNo: number } | null;
  todayNo: number;
  kind: "week" | "entry" | "counted";
  programName?: string | null;
}) {
  return (
    <div className="panel p-5 sm:p-7" data-hero="week-complete" data-week-kind={kind}>
      <span className="eyebrow inline-flex items-center gap-1.5 text-accent">
        <GCheck className="size-3.5" />
        {kind === "entry" ? "Semana de entrada concluída" : "Semana concluída"}
      </span>
      <h2 className="text-display mt-1 text-[1.5rem] font-semibold leading-tight sm:text-[1.75rem]">
        {kind === "entry" ? "Começo feito." : kind === "counted" ? "Semana já na meta." : "Todos os treinos da semana feitos."}
      </h2>
      <p className="mt-2 text-[15px] text-muted">
        {kind === "counted"
          ? `Descanse. ${programName ?? "O programa"} começa na semana que vem.`
          : "Descanse. Os resultados de cada dia estão logo abaixo."}
      </p>
      {next ? (
        <p className="mt-5 border-t border-border pt-4 text-[15px]">
          <span className="text-muted">Próximo · </span>
          <span className="font-semibold">
            {scheduleShifted({ dayName: next.day.name, dayNo: next.dayNo }) ? dayNameWithoutWeekday(next.day.name) : next.day.name}
          </span>{" "}
          <span className="tag tag--spec ml-1 text-[13px]">{dayTag(next.dayNo)}</span>
          <span className="sr-only"> ({whenText(next.dayNo, todayNo)})</span>
        </p>
      ) : null}
    </div>
  );
}

/**
 * A block finished in the last two weeks (program-lifecycle
 * getRecentlyCompletedBlock): what it added up to, and what comes next — the
 * GD series' next block, or the same block again.
 */
export function BlockCompletedHero({ block }: { block: CompletedBlock }) {
  const stats = [
    plural(block.weeks, "semana", "semanas"),
    block.plannedSessions ? `${block.sessionsDone} de ${block.plannedSessions} treinos` : plural(block.sessionsDone, "treino", "treinos"),
    block.prCount > 0 ? plural(block.prCount, "exercício com recorde", "exercícios com recorde") : null,
  ].filter(Boolean);
  return (
    <div className="panel p-5 sm:p-7" data-hero="block-complete">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="eyebrow inline-flex items-center gap-1.5 text-accent">
          <GCheck className="size-3.5" />
          {block.series && !block.next ? "Plano GD concluído" : "Bloco concluído"}
        </span>
        {block.series ? (
          <span className="text-[13px] tabular-nums text-muted">
            Bloco {block.series.index} de {block.series.total}
          </span>
        ) : null}
      </div>
      <h2 className="text-display mt-1 text-[1.875rem] font-bold leading-tight wrap-break-word sm:text-[2.25rem]">
        {block.programName}
      </h2>
      <p className="mt-2 text-[15px] tabular-nums text-muted">{stats.join(" · ")}</p>

      {block.anchorProgress && block.anchorProgress.length > 0 ? (
        <div className="mt-5">
          {/* A-019: the numbers are estimated 1RMs — say so on the hero, not only in the aria-label. */}
          <p className="text-[13px] font-medium text-muted">1RM estimado · 1ª → última semana</p>
          <ul
            className="mt-1.5 flex flex-col divide-y divide-border border-y border-border"
            aria-label="1RM estimado, do início ao fim do bloco"
          >
            {block.anchorProgress.map((a) => (
              <li key={a.slug} className="flex items-baseline justify-between gap-3 py-2.5">
                <Link
                  href={`/app/exercises/${a.slug}/history`}
                  className="line-clamp-2 min-w-0 text-[15px] font-medium leading-snug wrap-break-word hover:text-accent"
                >
                  {a.exerciseName}
                </Link>
                <span className="shrink-0 text-sm tabular-nums">
                  <span className="text-muted">{formatKg(a.fromKg)} →</span>{" "}
                  <span className={cn("font-semibold", a.toKg > a.fromKg && "text-accent")}>{formatKg(a.toKg)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {block.next ? (
          <InlineActionForm
            action={startNextBlock.bind(null, block.enrollmentId)}
            failText="Não foi possível começar o próximo bloco. Tente de novo."
            errorClassName="mt-2"
          >
            <SubmitButton size="lg" variant="strong" className="w-full sm:w-auto" pendingLabel="Ativando…">
              <Play className="size-4" />
              Começar {block.next.name}
            </SubmitButton>
          </InlineActionForm>
        ) : null}
        <InlineActionForm
          action={repeatBlock.bind(null, block.enrollmentId)}
          failText="Não foi possível repetir o bloco. Tente de novo."
          errorClassName="mt-2"
        >
          <SubmitButton
            size="lg"
            variant={block.next ? "ghost" : "strong"}
            className="w-full sm:w-auto"
            pendingLabel="Ativando…"
          >
            <RotateCcw className="size-4" />
            {block.series ? "Repetir bloco" : "Repetir"}
          </SubmitButton>
        </InlineActionForm>
        {/* Outside the GD series — or at its end (GD 8 done): pick what comes next. Wraps inside itself at 320px. */}
        {block.series && block.next ? null : (
          <Button size="lg" variant="outline" className="h-auto min-h-13 w-full whitespace-normal px-4 py-2.5 text-center sm:w-auto" asChild>
            <Link href="/app/programs">Ver programas recomendados</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

export function InProgressBlock({
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
    <div className="panel p-5 sm:p-7">
      <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-warning">
        <span aria-hidden className="size-2 shrink-0 rounded-full bg-warning" />
        Treino em andamento
      </span>
      <h2 className="text-display mt-1 text-[1.875rem] font-bold leading-tight wrap-break-word sm:text-[2.25rem]">{name}</h2>
      <p className="mt-2 text-[15px] tabular-nums text-muted">
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
