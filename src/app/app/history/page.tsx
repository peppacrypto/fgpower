import { Fragment } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import { GArrow, GCheck } from "@/components/ui/glyph";
import { requireUser } from "@/lib/auth/require-user";
import { listSessionsInRange, listAllSessions } from "@/lib/data/history";
import { dateOfDayNumber, getWeekRows } from "@/lib/data/progress";
import { dayNumberOf } from "@/lib/training/day-rotation";
import {
  currentMonth,
  daysInMonth as countDaysInMonth,
  firstWeekdayOfMonth,
  wallClock,
  monthBounds,
  zonedMidnight,
} from "@/lib/training/week";
import { MIN_HISTORY_YEAR, parseDayParam, parseMonthParams } from "./params";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { cn } from "@/lib/utils/cn";
import { formatDuration, formatVolume, plural } from "@/lib/utils/format";
import { SessionRow } from "./session-row";

export const metadata: Metadata = { title: "Histórico" };

/** Monday-first, like every week in the app (lib/training/week). */
const WEEKDAY_LABELS = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const ARROW = "flex size-11 items-center justify-center rounded-[3px]";

export default async function HistoryPage({ searchParams }: PageProps<"/app/history">) {
  const sp = await searchParams;
  const user = await requireUser();

  // Month navigation and day buckets follow the São Paulo calendar (the
  // server runs in UTC — a 22:00 workout must not land on tomorrow's cell).
  const now = new Date();
  const today = currentMonth(now);
  const { year, month0: month } = parseMonthParams(sp, today);
  const { start, end } = monthBounds(year, month);
  const daysInMonth = countDaysInMonth(year, month);
  const selectedDay = parseDayParam(sp.day, daysInMonth);

  // The grid's rows are Monday-start weeks; the first starts on or before the 1st.
  const lead = (firstWeekdayOfMonth(year, month) + 6) % 7;
  const cells: (number | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const rows = Array.from({ length: cells.length / 7 }, (_, r) => ({
    days: cells.slice(r * 7, r * 7 + 7),
    weekStart: zonedMidnight(year, month, 1 - lead + r * 7),
  }));
  // The grid's last week ends on a Sunday that may be in the next month: read
  // the weeks up to its end, so a week the user met keeps its ✓ in both months.
  const gridEnd = dateOfDayNumber(dayNumberOf(rows[rows.length - 1].weekStart) + 7);

  const [sessions, recent, weeks] = await Promise.all([
    listSessionsInRange(user.id, start, end),
    listAllSessions(user.id, 1, 10),
    // The streak's weeks (Today's rule) up to the grid's last one.
    getWeekRows(user.id, new Date(Math.min(now.getTime(), gridEnd.getTime() - 1))),
  ]);

  const sessionsByDay = new Map<number, typeof sessions>();
  for (const s of sessions) {
    if (!s.finishedAt) continue;
    const day = wallClock(s.finishedAt).day;
    const list = sessionsByDay.get(day) ?? [];
    list.push(s);
    sessionsByDay.set(day, list);
  }
  const metWeeks = new Map(weeks.filter((w) => w.met).map((w) => [w.monday, w]));

  function monthHref(delta: number) {
    const total = year * 12 + month + delta;
    return `/app/history?year=${Math.floor(total / 12)}&month=${total % 12}`;
  }
  const dayHref = (day: number) => `/app/history?year=${year}&month=${month}&day=${day}`;

  const isCurrentMonth = year === today.year && month === today.month0;
  const isFirstMonth = year === MIN_HISTORY_YEAR && month === 0;
  const todayDay = isCurrentMonth ? wallClock(now).day : null;

  const monthStats = [
    plural(sessions.length, "treino", "treinos"),
    sessions.some((s) => s.durationSeconds)
      ? formatDuration(sessions.reduce((t, s) => t + (s.durationSeconds ?? 0), 0))
      : null,
    plural(
      sessions.reduce((t, s) => t + (s.totalWorkingSets ?? 0), 0),
      "série",
      "séries",
    ),
    sessions.some((s) => s.totalVolumeKg) ? formatVolume(sessions.reduce((t, s) => t + (s.totalVolumeKg ?? 0), 0)) : null,
  ].filter((x) => x !== null);
  const dayList = selectedDay ? (sessionsByDay.get(selectedDay) ?? []) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-2xl font-bold tracking-tight">Histórico</h1>

      <Card className="mt-6">
        <CardContent className="px-3 pt-3 pb-4 sm:px-5">
          <div className="flex items-center justify-between">
            <Link
              href={monthHref(-1)}
              aria-label="Mês anterior"
              aria-disabled={isFirstMonth}
              className={isFirstMonth ? `${ARROW} pointer-events-none opacity-30` : `${ARROW} hover:bg-surface-2`}
            >
              <ChevronLeft className="size-5" />
            </Link>
            <div className="text-center">
              <h2 className="font-semibold">
                {MONTH_LABELS[month]} {year}
              </h2>
              <p data-month-summary className="font-mono text-[11px] tabular-nums text-muted">
                {sessions.length === 0
                  ? "nenhum treino neste mês"
                  : monthStats.map((t, i) => (
                      <Fragment key={i}>
                        {i > 0 ? " " : null}
                        <span className="whitespace-nowrap">
                          {t}
                          {i < monthStats.length - 1 ? " ·" : ""}
                        </span>
                      </Fragment>
                    ))}
              </p>
            </div>
            <Link
              href={monthHref(1)}
              aria-label="Próximo mês"
              aria-disabled={isCurrentMonth}
              className={isCurrentMonth ? `${ARROW} pointer-events-none opacity-30` : `${ARROW} hover:bg-surface-2`}
            >
              <ChevronRight className="size-5" />
            </Link>
          </div>

          <div className="mt-3 grid grid-cols-[repeat(7,minmax(0,1fr))_1rem] gap-1 text-center font-mono text-[10px] tracking-wider text-muted">
            {WEEKDAY_LABELS.map((d) => (
              <div key={d}>{d}</div>
            ))}
            <div />
          </div>
          <div className="mt-1 flex flex-col gap-1">
            {rows.map((row) => {
              const metWeek = metWeeks.get(dayNumberOf(row.weekStart));
              const met = metWeek != null;
              return (
                <div
                  key={row.weekStart.getTime()}
                  data-week-met={met || undefined}
                  className="grid grid-cols-[repeat(7,minmax(0,1fr))_1rem] items-center gap-1"
                >
                  {row.days.map((day, i) => {
                    const daySessions = day ? (sessionsByDay.get(day) ?? []) : [];
                    const isToday = day != null && day === todayDay;
                    const hasRecord = daySessions.some((s) => s.recordCount > 0);
                    const label =
                      day == null
                        ? ""
                        : `${day} de ${MONTH_LABELS[month].toLowerCase()}: ${plural(daySessions.length, "treino", "treinos")}${hasRecord ? ", com recorde" : ""}${isToday ? " (hoje)" : ""}`;
                    return (
                      <div key={i} className="flex aspect-square items-center justify-center">
                        {day == null ? null : daySessions.length > 0 ? (
                          <Link
                            href={daySessions.length === 1 ? `/app/workout/${daySessions[0].id}/summary` : dayHref(day)}
                            aria-label={label}
                            aria-current={day === selectedDay ? "date" : undefined}
                            data-today={isToday || undefined}
                            data-active={isToday || undefined}
                            className={cn(
                              "relative flex size-full flex-col items-center justify-center gap-0.5 rounded-[var(--radius-sm)] bg-accent-soft text-sm leading-none font-semibold text-accent",
                              hasRecord && "shadow-[inset_0_-3px_0_var(--accent)]",
                              isToday && "reg-frame bg-accent-soft",
                              day === selectedDay && "outline-2 outline-offset-1 outline-accent",
                            )}
                          >
                            {day}
                            {daySessions.length > 1 ? (
                              <span aria-hidden className="flex gap-0.5">
                                {daySessions.slice(0, 3).map((s) => (
                                  <span key={s.id} className="size-1 rounded-full bg-accent" />
                                ))}
                              </span>
                            ) : null}
                          </Link>
                        ) : (
                          <span
                            aria-label={isToday ? label : undefined}
                            data-today={isToday || undefined}
                            data-active={isToday || undefined}
                            className={cn(
                              "flex size-full items-center justify-center text-sm text-muted",
                              isToday && "reg-frame bg-transparent font-semibold text-foreground",
                            )}
                          >
                            {day}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  <span className="flex items-center justify-center text-accent">
                    {met ? (
                      <>
                        <GCheck className="size-3.5" aria-hidden />
                        <span className="sr-only">{metWeek.deload ? "Semana de descarga na meta" : "Semana na meta"}</span>
                      </>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
          {/* What the marks mean. */}
          <p aria-hidden className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[10px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-3 rounded-[1px] bg-accent-soft shadow-[inset_0_-2px_0_var(--accent)]" />
              recorde
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="flex gap-0.5">
                <span className="size-1 rounded-full bg-accent" />
                <span className="size-1 rounded-full bg-accent" />
              </span>
              2+ treinos no dia
            </span>
            <span className="inline-flex items-center gap-1.5">
              <GCheck className="size-3 text-accent" />
              semana na meta
            </span>
          </p>
        </CardContent>
      </Card>

      {dayList ? (
        <section className="mt-8" aria-labelledby="dia">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 id="dia" className="text-sm font-bold uppercase tracking-wide text-muted">
              Treinos de {selectedDay} de {MONTH_LABELS[month].toLowerCase()}
            </h2>
            <Link
              href={`/app/history?year=${year}&month=${month}`}
              className="-my-2 inline-flex min-h-11 items-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-accent hover:underline"
            >
              Ver recentes
            </Link>
          </div>
          {dayList.length === 0 ? (
            <p className="text-sm text-muted">Nenhum treino neste dia.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {dayList.map((s) => (
                <SessionRow key={s.id} session={s} />
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="mt-8" aria-labelledby="recentes">
          <h2 id="recentes" className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
            Treinos recentes
          </h2>
          {recent.items.length === 0 ? (
            <EmptyState
              icon={<CalendarClock className="size-8" />}
              title="Nenhum treino concluído ainda"
              description="Cada treino que você finalizar aparece aqui e no calendário, com duração, séries e recordes."
              action={
                <Button variant="strong" asChild className="mt-1">
                  <Link href="/app/today">Ir para Hoje</Link>
                </Button>
              }
            />
          ) : (
            <div className="flex flex-col gap-2">
              {recent.items.map((s) => (
                <SessionRow key={s.id} session={s} />
              ))}
            </div>
          )}
          {recent.totalPages > 1 ? (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" size="sm" asChild>
                <Link href="/app/history/all">
                  Ver todo o histórico
                  <GArrow className="size-3" />
                </Link>
              </Button>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
