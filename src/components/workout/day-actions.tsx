import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { startAdHocWorkoutSession } from "@/lib/actions/workouts";
import { resolveSessionDay } from "@/lib/training/day-match";
import { InlineActionForm } from "./inline-action-form";
import { RedoDayButton } from "./redo-day-button";

export type DayState =
  | { kind: "in-progress"; sessionId: string; doneSessionId?: string }
  | { kind: "done"; sessionId: string }
  | { kind: "idle" };

interface OpenSession {
  id: string;
  name: string;
  programId: string | null;
  programDayId: string | null;
  programDayIndex: number | null;
}

/** Where each program day stands for the user right now, keyed by day id. */
export function dayStates(
  days: { id: string; programId: string; dayIndex: number; name: string }[],
  inProgress: OpenSession[],
  doneThisWeek: Map<string, string>,
): Map<string, DayState> {
  const openByDay = new Map<string, string>();
  for (const s of inProgress) {
    if (!days.some((d) => d.programId === s.programId)) continue;
    const day = resolveSessionDay(s, days);
    if (day && !openByDay.has(day.id)) openByDay.set(day.id, s.id);
  }
  const states = new Map<string, DayState>();
  for (const day of days) {
    const open = openByDay.get(day.id);
    const done = doneThisWeek.get(day.id);
    states.set(
      day.id,
      open
        ? { kind: "in-progress", sessionId: open, doneSessionId: done }
        : done
          ? { kind: "done", sessionId: done }
          : { kind: "idle" },
    );
  }
  return states;
}

/** "6 exercícios" — or, for a day with none yet, "Sem exercícios". */
export function exerciseCount(n: number) {
  return n === 0 ? "Sem exercícios" : n === 1 ? "1 exercício" : `${n} exercícios`;
}

/**
 * The action for one program day. A day already trained this week opens its
 * saved result ("Ver") — training it again is an explicit, confirmed
 * "Refazer" — and a day in progress continues the same session. Starting is
 * locked while another workout with logged sets is open, so a second copy of
 * a day can never be created. A day without exercises can't be started (it
 * would open a blank workout); it offers the program editor instead.
 */
export function DayActions({
  dayId,
  state,
  locked,
  emphasize = false,
  editHref,
}: {
  dayId: string;
  state: DayState;
  /** Another workout with logged sets is in progress. */
  locked: boolean;
  emphasize?: boolean;
  /** Set when the day has no exercises: where to add some. */
  editHref?: string;
}) {
  if (state.kind === "in-progress") {
    return (
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {state.doneSessionId ? (
          <Button variant="outline" asChild className="px-3.5">
            <Link href={`/app/workout/${state.doneSessionId}/summary`}>Ver salvo</Link>
          </Button>
        ) : null}
        <Button asChild className="px-3.5">
          <Link href={`/app/workout/${state.sessionId}`}>Continuar</Link>
        </Button>
      </div>
    );
  }
  if (state.kind === "done") {
    return (
      <div className="ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2">
        <Button variant="outline" asChild className="px-3.5">
          <Link href={`/app/workout/${state.sessionId}/summary`}>Ver</Link>
        </Button>
        {locked ? null : <RedoDayButton dayId={dayId} />}
      </div>
    );
  }
  if (editHref) {
    return (
      <Button variant="ghost" asChild className="ml-auto shrink-0 px-3.5">
        <Link href={editHref}>Editar</Link>
      </Button>
    );
  }
  if (locked) {
    return (
      <Button variant="outline" disabled className="ml-auto shrink-0 px-3.5">
        Iniciar
      </Button>
    );
  }
  return (
    <InlineActionForm
      action={startAdHocWorkoutSession.bind(null, dayId)}
      failText="Não foi possível iniciar. Tente de novo."
      className="ml-auto flex shrink-0 flex-col items-end"
      errorClassName="mt-1 max-w-[13rem] text-right text-[11px] leading-snug"
    >
      <SubmitButton variant={emphasize ? "primary" : "outline"} className="px-3.5" pendingLabel="Iniciando…">
        Iniciar
      </SubmitButton>
    </InlineActionForm>
  );
}

/** Small status line fragment for a day row. */
export function DayStatus({ state, suggested }: { state: DayState; suggested: boolean }) {
  if (state.kind === "done") return <span className="font-semibold text-accent"> · feito esta semana ✓</span>;
  if (state.kind === "in-progress") {
    return (
      <span className="font-semibold text-warning">
        {state.doneSessionId ? " · feito ✓ · refazendo" : " · em andamento"}
      </span>
    );
  }
  return suggested ? <span className="text-accent"> · sugerido</span> : null;
}
