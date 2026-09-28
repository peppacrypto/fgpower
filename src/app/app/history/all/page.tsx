import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, ChevronLeft } from "lucide-react";
import { GCheck } from "@/components/ui/glyph";
import { requireUser } from "@/lib/auth/require-user";
import { listAllSessions } from "@/lib/data/history";
import { dateOfDayNumber, getWeekRows } from "@/lib/data/progress";
import { dayNumberOf, mondayOf } from "@/lib/training/day-rotation";
import { startOfWeek, wallClock } from "@/lib/training/week";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { parsePageParam } from "../params";
import { SessionRow } from "../session-row";

export const metadata: Metadata = { title: "Todo o histórico" };

const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

/** "21–27 SET", "28 SET – 04 OUT", with the year when it isn't this one. */
function weekRange(start: Date, now: Date) {
  const a = wallClock(start);
  const b = wallClock(new Date(start.getTime() + 6 * 86_400_000 + 12 * 3_600_000));
  const dd = (n: number) => String(n).padStart(2, "0");
  const year = b.year !== wallClock(now).year ? ` ${b.year}` : "";
  return a.month === b.month
    ? `${dd(a.day)}–${dd(b.day)} ${MONTHS[b.month - 1]}${year}`
    : `${dd(a.day)} ${MONTHS[a.month - 1]} – ${dd(b.day)} ${MONTHS[b.month - 1]}${year}`;
}

export default async function AllHistoryPage({ searchParams }: PageProps<"/app/history/all">) {
  const sp = await searchParams;
  const user = await requireUser();
  const now = new Date();
  // listAllSessions clamps to [1, totalPages] and returns the page it served.
  const { items, page, totalPages } = await listAllSessions(user.id, parsePageParam(sp.page), 20);

  // Grouped by São Paulo week (Monday-start, like Today's), newest first; each
  // week says which program week it was and how much of its target was done.
  const dated = items.filter((s) => s.finishedAt);
  const newest = dated[0]?.finishedAt;
  // The streak's weeks (Today's rule), read up to the end of this page's newest week.
  const ledger = newest
    ? await getWeekRows(
        user.id,
        new Date(Math.min(now.getTime(), dateOfDayNumber(mondayOf(dayNumberOf(newest)) + 7).getTime() - 1)),
      )
    : [];
  const groups: { start: Date; sessions: typeof items }[] = [];
  for (const s of dated) {
    const start = startOfWeek(s.finishedAt as Date);
    const last = groups[groups.length - 1];
    if (last && last.start.getTime() === start.getTime()) last.sessions.push(s);
    else groups.push({ start, sessions: [s] });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <Link
        href="/app/history"
        className="-mt-2 -ml-1 inline-flex min-h-11 items-center gap-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" aria-hidden />
        Histórico
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">Todo o histórico</h1>

      {items.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<CalendarClock className="size-8" />}
            title="Nenhum treino concluído ainda"
            description="Cada treino que você finalizar aparece aqui, semana a semana."
            action={
              <Button variant="strong" asChild className="mt-1">
                <Link href="/app/today">Ir para Hoje</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-7">
          {groups.map((g) => {
            const row = ledger.find((w) => w.monday === dayNumberOf(g.start));
            // The week is named by the program it's judged by (the streak's row: the one whose week
            // counts, or a switch's entry week), so the label and the count are the same program's.
            const judged = row?.enrollmentId ? g.sessions.find((s) => s.enrollmentId === row.enrollmentId) : undefined;
            // A week judged by a program not trained in it yet (switched to midweek): no count under another's name.
            const week = row && (row.enrollmentId == null || judged) ? row : undefined;
            // The program week as Today numbers it (history.ts countedWeek: a
            // Thursday–Sunday entry week is "de entrada" only when trained in).
            const programmed =
              (judged?.program && judged.countedWeek != null ? judged : undefined) ??
              g.sessions.find((s) => s.program && s.countedWeek != null);
            const programWeek = programmed?.countedWeek ?? null;
            const label = programmed
              ? `${programWeek === 0 ? "Semana de entrada" : `Semana ${programWeek}`} · ${programmed.program!.name}`
              : "Sem programa";
            // A planned deload week: any workout counts, so its target isn't the point.
            const deloadMet = week?.deload === true && week.met;
            return (
              <section key={g.start.getTime()} aria-label={`${label}, ${weekRange(g.start, now)}`}>
                <div className="mb-2.5 flex items-baseline justify-between gap-3 border-b border-border pb-1.5">
                  <p className="min-w-0 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-foreground">
                    {label}
                    {week ? (
                      <span data-week-mark className={week.met ? "text-accent" : "text-muted"}>
                        {" · "}
                        {deloadMet ? "descarga" : `${week.done}/${week.target}`}
                        {week.met ? (
                          <>
                            <GCheck className="ml-1 inline size-3 align-[-1px]" aria-hidden />
                            <span className="sr-only">{deloadMet ? " (semana de descarga, na meta)" : " (semana na meta)"}</span>
                          </>
                        ) : null}
                      </span>
                    ) : null}
                  </p>
                  <span className="shrink-0 font-mono text-[10px] tracking-wider tabular-nums text-muted">
                    {weekRange(g.start, now)}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {g.sessions.map((s) => (
                    <SessionRow key={s.id} session={s} dateStyle="weekday" />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="mt-6 flex items-center justify-center gap-2">
          {page > 1 ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/app/history/all?page=${page - 1}`}>Anterior</Link>
            </Button>
          ) : null}
          <span className="px-2 text-sm text-muted">
            Página {page} de {totalPages}
          </span>
          {page < totalPages ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/app/history/all?page=${page + 1}`}>Próxima</Link>
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
