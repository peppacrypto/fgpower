import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth/require-user";
import { listSessionsInRange, listAllSessions } from "@/lib/data/history";
import {
  currentMonth,
  daysInMonth as countDaysInMonth,
  firstWeekdayOfMonth,
  formatAppDate,
  monthBounds,
  wallClock,
} from "@/lib/training/week";
import { MIN_HISTORY_YEAR, parseMonthParams } from "./params";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { CalendarClock } from "lucide-react";
import { formatDuration, plural } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Histórico" };

const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default async function HistoryPage({ searchParams }: PageProps<"/app/history">) {
  const sp = await searchParams;
  const user = await requireUser();

  // Month navigation and day buckets follow the São Paulo calendar (the
  // server runs in UTC — a 22:00 workout must not land on tomorrow's cell).
  const today = currentMonth();
  const { year, month0: month } = parseMonthParams(sp, today);
  const { start, end } = monthBounds(year, month);

  const [sessions, recent] = await Promise.all([
    listSessionsInRange(user.id, start, end),
    listAllSessions(user.id, 1, 10),
  ]);

  const sessionsByDay = new Map<number, typeof sessions>();
  for (const s of sessions) {
    if (!s.finishedAt) continue;
    const day = wallClock(s.finishedAt).day;
    const list = sessionsByDay.get(day) ?? [];
    list.push(s);
    sessionsByDay.set(day, list);
  }

  const startWeekday = firstWeekdayOfMonth(year, month);
  const daysInMonth = countDaysInMonth(year, month);
  const cells: (number | null)[] = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function monthHref(delta: number) {
    const total = year * 12 + month + delta;
    return `/app/history?year=${Math.floor(total / 12)}&month=${total % 12}`;
  }

  const isCurrentMonth = year === today.year && month === today.month0;
  const isFirstMonth = year === MIN_HISTORY_YEAR && month === 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-2xl font-bold tracking-tight">Histórico</h1>

      <Card className="mt-6">
        <CardContent className="pt-5">
          <div className="flex items-center justify-between">
            <Link
              href={monthHref(-1)}
              aria-label="Mês anterior"
              aria-disabled={isFirstMonth}
              className={
                isFirstMonth
                  ? "pointer-events-none flex size-8 items-center justify-center rounded-[3px] opacity-30"
                  : "flex size-8 items-center justify-center rounded-[3px] hover:bg-surface-2"
              }
            >
              <ChevronLeft className="size-4" />
            </Link>
            <h2 className="font-semibold">
              {MONTH_LABELS[month]} {year}
            </h2>
            <Link
              href={monthHref(1)}
              aria-label="Próximo mês"
              aria-disabled={isCurrentMonth}
              className={
                isCurrentMonth
                  ? "pointer-events-none flex size-8 items-center justify-center rounded-[3px] opacity-30"
                  : "flex size-8 items-center justify-center rounded-[3px] hover:bg-surface-2"
              }
            >
              <ChevronRight className="size-4" />
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs text-muted">
            {WEEKDAY_LABELS.map((d, i) => (
              <div key={i}>{d}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              const daySessions = day ? sessionsByDay.get(day) : undefined;
              const hasWorkout = Boolean(daySessions?.length);
              return (
                <div key={i} className="flex aspect-square items-center justify-center">
                  {day ? (
                    hasWorkout ? (
                      <Link
                        href={`/app/workout/${daySessions![0].id}/summary`}
                        className="flex size-full flex-col items-center justify-center rounded-[var(--radius-sm)] bg-accent-soft text-sm font-semibold text-accent"
                      >
                        {day}
                      </Link>
                    ) : (
                      <span className="text-sm text-muted">{day}</span>
                    )
                  ) : null}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Treinos recentes</h2>
        {recent.items.length === 0 ? (
          <EmptyState
            icon={<CalendarClock className="size-8" />}
            title="Nenhum treino concluído ainda"
            description="Seus treinos concluídos aparecem aqui."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {recent.items.map((s) => (
              <Link key={s.id} href={`/app/workout/${s.id}/summary`}>
                <Card className="is-link">
                  <CardContent className="flex items-center justify-between gap-3 py-3.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{s.name}</p>
                      <p className="text-xs text-muted">
                        {s.finishedAt ? formatAppDate(s.finishedAt, { day: "2-digit", month: "short", year: "numeric" }) : null}
                      </p>
                    </div>
                    <p className="shrink-0 whitespace-nowrap text-xs text-muted">
                      {s.durationSeconds ? `${formatDuration(s.durationSeconds)} · ` : ""}
                      {plural(s.totalWorkingSets ?? 0, "série", "séries")}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {recent.totalPages > 1 ? (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" size="sm" asChild>
            <Link href="/app/history/all">Ver todo o histórico</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
