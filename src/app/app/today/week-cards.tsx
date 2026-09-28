import { Fragment } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { GArrow, GCheck } from "@/components/ui/glyph";
import { weekdayName, type WeekStripCell } from "@/lib/training/day-rotation";
import type { WeekGuidanceView } from "@/lib/training/week-guidance";
import { formatNumber, plural, pluralWord } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { nudgeFits } from "./streak-nudge";

const WEEKDAY_SHORT = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const label = "text-[10px] font-bold uppercase tracking-[0.18em] text-muted";

/** The weekly streak line: "4 SEMANAS SEGUIDAS · RECORDE 6" (weekly only — lib/training/streak). */
export function streakText(current: number, best: number): string | null {
  if (current < 1) return null;
  const run = current === 1 ? "1 semana na meta" : `${current} semanas seguidas`;
  return best > current ? `${run} · recorde ${best}` : run;
}

/**
 * "Esta semana": workouts done of the week's target, the 7-day strip
 * (planned days, days trained, today) and the weekly streak. From Thursday,
 * a neutral count of what's left for the week to count — never a warning,
 * and only when it fits the days left (nudgeFits). In a program's entry week
 * the count is for the week to count ("esta semana contar": falling short
 * never breaks the run); a test or deload week asks for one workout.
 */
export function ThisWeekCard({
  done,
  target,
  strip,
  streak,
  entry,
  programName = null,
  durationWeeks,
}: {
  done: number;
  target: number;
  strip: WeekStripCell[];
  streak: {
    current: number;
    best: number;
    /** Workouts still needed this week (0 once it counts); shown from Thursday on. */
    remaining: number;
    deload: boolean;
    /** A GD block's test week (its Mon–Wed deload): said as the test week, not a deload. */
    test?: boolean;
    /** Falling short now wouldn't break the run (a free week, one per 8, or a neutral entry week). */
    freeWeekAvailable: boolean;
    thursdayOrLater: boolean;
    /** Days left this week, today included: a count the week can't reach at the plan's spacing isn't shown. */
    daysLeft: number;
    /** Workouts a week the plan asks for (its spacing). */
    perWeek: number;
  };
  /**
   * An entry week (Thursday–Sunday start): the days left in it; `alreadyCounts`
   * when the week was already met through another program (then it's done).
   */
  entry: { daysLeft: number; alreadyCounts?: boolean } | null;
  /** The running program ("o GD 1 começa na semana que vem"). */
  programName?: string | null;
  durationWeeks: number | null;
}) {
  const streakLine = streakText(streak.current, streak.best);
  const nudge =
    streak.current >= 1 && streak.thursdayOrLater && nudgeFits(streak.remaining, streak.daysLeft, streak.perWeek)
      ? streak.test
        ? "Semana de teste: 1 treino já conta"
        : streak.deload
          ? "Semana de deload: 1 treino já conta"
          : `${streak.remaining === 1 ? "Falta 1 treino" : `Faltam ${streak.remaining} treinos`} para ${
              streak.freeWeekAvailable ? "esta semana contar" : "manter a sequência"
            }`
      : null;
  const counted = entry?.alreadyCounts === true;
  return (
    <div className="min-w-0 reg-frame p-5" data-week-card>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5">
        <span className={cn(label, "whitespace-nowrap")}>Esta semana</span>
        {entry && !counted ? <span className="tag tag--mark shrink-0">Semana de entrada</span> : null}
      </div>
      <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums">
        {done}
        <span className="text-base text-muted"> / {target}</span>
        <span className="ml-2 align-middle font-sans text-[10px] font-bold uppercase tracking-wider text-muted">
          {pluralWord(target, "treino", "treinos")}
        </span>
      </p>

      <ol className="mt-3 grid grid-cols-7 gap-1" aria-label="Dias desta semana">
        {strip.map((cell) => {
          const state = cell.done ? "treino feito" : cell.planned ? "dia de treino" : "descanso";
          return (
            <li
              key={cell.dayNo}
              aria-label={`${weekdayName(cell.weekday)}${cell.today ? " (hoje)" : ""}: ${state}`}
              aria-current={cell.today ? "date" : undefined}
              data-day-state={cell.done ? "done" : cell.planned ? "planned" : "rest"}
              className="flex min-w-0 flex-col items-center gap-1"
            >
              <span
                className={cn(
                  "font-mono text-[9px] font-bold tracking-[0.06em] min-[360px]:text-[10px]",
                  cell.today ? "text-foreground" : "text-muted",
                )}
                aria-hidden
              >
                {WEEKDAY_SHORT[cell.weekday]}
              </span>
              <span
                aria-hidden
                className={cn(
                  "flex h-8 w-full items-center justify-center rounded-[3px]",
                  cell.done
                    ? "bg-accent text-accent-foreground"
                    : cell.planned
                      ? cn("border-2 bg-surface", cell.past ? "border-foreground/25!" : "border-foreground/50!")
                      : "bg-surface-2",
                  // Today: an inked keel under the cell.
                  cell.today && "shadow-[inset_0_-3px_0_var(--foreground)]",
                )}
              >
                {cell.done ? <GCheck className="size-3.5" /> : null}
              </span>
            </li>
          );
        })}
      </ol>

      {streakLine || nudge || entry ? (
        <div className="mt-3 flex flex-col gap-0.5">
          {streakLine ? (
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-accent" data-streak>
              {streakLine}
            </p>
          ) : null}
          {nudge ? <p className="text-xs text-muted">{nudge}.</p> : null}
          {counted ? (
            <p className="text-xs text-muted" data-week-counted>
              {programName ?? "O programa"} começa na semana que vem.
            </p>
          ) : entry ? (
            <p className="text-xs text-muted">
              {entry.daysLeft === 1 ? "Último dia" : `${entry.daysLeft} dias restantes`} · o que der nesta semana
              {durationWeeks ? ` fica fora das ${durationWeeks} semanas do programa` : " não conta na duração do programa"}.
            </p>
          ) : null}
        </div>
      ) : null}

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
  );
}

/** "SEMANA 5 DE 13 · RIR ALVO 1", "SEMANA DE ENTRADA", "… · SEMANA DE TESTE", "… · DELOAD" — as its parts. */
export function weekLine(p: {
  week: { kind: "entry" } | { kind: "week"; week: number };
  durationWeeks: number | null;
  guidance: WeekGuidanceView | null;
}): string[] {
  const head =
    p.week.kind === "entry"
      ? "Semana de entrada"
      : p.durationWeeks
        ? `Semana ${Math.min(p.week.week, p.durationWeeks)} de ${p.durationWeeks}`
        : `Semana ${p.week.week}`;
  const g = p.guidance;
  const tail = !g
    ? null
    : g.test
      ? "Semana de teste"
      : g.deload
        ? "Deload"
        : g.rirTarget != null
          ? `RIR alvo ${formatNumber(g.rirTarget, 1)}`
          : null;
  return tail ? [head, tail] : [head];
}

/**
 * The active program: where the block stands (week N of M, workouts done,
 * adherence — W-125), this week's guidance (RIR wave, deload, test week —
 * W-054) with its instructions folded, and the way to the program page.
 */
export function ProgramCard({
  programId,
  name,
  series,
  week,
  durationWeeks,
  guidance,
  progress,
}: {
  programId: string;
  name: string;
  series: { index: number; total: number } | null;
  week: { kind: "entry" } | { kind: "week"; week: number };
  durationWeeks: number | null;
  guidance: WeekGuidanceView | null;
  progress: { sessionsDone: number; plannedSessions: number | null; adherencePct: number | null } | null;
}) {
  const current = week.kind === "entry" ? 0 : Math.min(week.week, durationWeeks ?? week.week);
  const science = guidance?.deload || guidance?.test ? "/app/science/deloads" : "/app/science/rir";
  return (
    <div className="min-w-0 reg-frame p-5" data-program-card>
      <div className="flex items-baseline justify-between gap-3">
        <span className={label}>Programa</span>
        {series ? (
          <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
            Bloco {series.index} de {series.total}
          </span>
        ) : null}
      </div>
      <Link
        href={`/app/programs/${programId}`}
        className="group mt-1.5 flex items-center gap-1.5 text-sm font-semibold hover:text-accent"
      >
        <span className="line-clamp-2 min-w-0 wrap-break-word">{name}</span>
        <GArrow className="size-3 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
      </Link>
      {/* Each part stays whole; the line breaks at the separator (320px: "Semana 13 de 13 ·" / "Semana de teste"). */}
      <p className="mt-3 font-mono text-[11px] font-bold uppercase tracking-[0.12em]" data-week-line>
        {weekLine({ week, durationWeeks, guidance }).map((part, i) => (
          <Fragment key={part}>
            {i > 0 ? " · " : null}
            <span className="whitespace-nowrap">{part}</span>
          </Fragment>
        ))}
      </p>
      {durationWeeks ? (
        <div className="mt-2 flex gap-1" aria-hidden>
          {Array.from({ length: durationWeeks }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full",
                i < current - 1 ? "bg-accent" : i === current - 1 ? "bg-foreground" : "bg-surface-2",
              )}
            />
          ))}
        </div>
      ) : null}
      {progress && week.kind !== "entry" ? (
        <p className="mt-2 text-xs text-muted">
          {progress.plannedSessions
            ? `${progress.sessionsDone} de ${progress.plannedSessions} treinos`
            : plural(progress.sessionsDone, "treino", "treinos")}
        </p>
      ) : null}

      {guidance && (guidance.notePt || guidance.setsNotePt) ? (
        <details className="group/week mt-3 border-t border-border pt-1" data-week-guidance>
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold text-accent [&::-webkit-details-marker]:hidden">
            Instruções da semana
            <ChevronDown className="size-3.5 shrink-0 transition-transform group-open/week:rotate-180" aria-hidden />
          </summary>
          <div className="flex flex-col gap-2 pb-1 text-xs leading-relaxed text-foreground/90">
            {guidance.notePt ? <p>{guidance.notePt}</p> : null}
            {guidance.setsNotePt ? (
              <p>
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Séries · </span>
                {guidance.setsNotePt}
              </p>
            ) : null}
            <Link href={science} className="inline-flex items-center gap-1 self-start py-1 font-semibold text-accent hover:underline">
              {guidance.deload || guidance.test ? "Por que semanas leves" : "Entenda o RIR"}
              <GArrow className="size-3" />
            </Link>
          </div>
        </details>
      ) : null}
    </div>
  );
}
