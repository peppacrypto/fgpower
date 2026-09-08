import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth/require-user";
import { listSessionsInRange, listAllSessions } from "@/lib/data/history";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { CalendarClock } from "lucide-react";

export const metadata: Metadata = { title: "Histórico" };

const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function formatDuration(seconds: number | null) {
  if (!seconds) return "";
  const m = Math.round(seconds / 60);
  return `${m} min`;
}

export default async function HistoryPage({ searchParams }: PageProps<"/app/history">) {
  const sp = await searchParams;
  const user = await requireUser();

  const now = new Date();
  const year = typeof sp.year === "string" ? Number(sp.year) : now.getFullYear();
  const month = typeof sp.month === "string" ? Number(sp.month) : now.getMonth(); // 0-indexed

  const firstOfMonth = new Date(year, month, 1);
  const firstOfNextMonth = new Date(year, month + 1, 1);
  const [sessions, recent] = await Promise.all([
    listSessionsInRange(user.id, firstOfMonth, firstOfNextMonth),
    listAllSessions(user.id, 1, 10),
  ]);

  const sessionsByDay = new Map<number, typeof sessions>();
  for (const s of sessions) {
    if (!s.finishedAt) continue;
    const day = s.finishedAt.getDate();
    const list = sessionsByDay.get(day) ?? [];
    list.push(s);
    sessionsByDay.set(day, list);
  }

  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function monthHref(delta: number) {
    const d = new Date(year, month + delta, 1);
    return `/app/history?year=${d.getFullYear()}&month=${d.getMonth()}`;
  }

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-2xl font-bold tracking-tight">Histórico</h1>

      <Card className="mt-6">
        <CardContent className="pt-5">
          <div className="flex items-center justify-between">
            <Link href={monthHref(-1)} className="flex size-8 items-center justify-center rounded-full hover:bg-surface-2">
              <ChevronLeft className="size-4" />
            </Link>
            <h2 className="font-semibold">
              {MONTH_LABELS[month]} {year}
            </h2>
            <Link
              href={monthHref(1)}
              aria-disabled={isCurrentMonth}
              className={
                isCurrentMonth
                  ? "pointer-events-none flex size-8 items-center justify-center rounded-full opacity-30"
                  : "flex size-8 items-center justify-center rounded-full hover:bg-surface-2"
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
                <Card className="transition-colors hover:border-accent/50">
                  <CardContent className="flex items-center justify-between py-3.5">
                    <div>
                      <p className="text-sm font-semibold">{s.name}</p>
                      <p className="text-xs text-muted">
                        {s.finishedAt?.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <p className="text-xs text-muted">
                      {formatDuration(s.durationSeconds)} · {s.totalWorkingSets ?? 0} séries
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
