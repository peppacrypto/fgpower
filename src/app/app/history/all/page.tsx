import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { requireUser } from "@/lib/auth/require-user";
import { listAllSessions } from "@/lib/data/history";
import { formatAppDate } from "@/lib/training/week";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { formatDuration, plural } from "@/lib/utils/format";
import { parsePageParam } from "../params";

export const metadata: Metadata = { title: "Todo o histórico" };

export default async function AllHistoryPage({ searchParams }: PageProps<"/app/history/all">) {
  const sp = await searchParams;
  const user = await requireUser();
  // listAllSessions clamps to [1, totalPages] and returns the page it served.
  const { items, page, totalPages } = await listAllSessions(user.id, parsePageParam(sp.page), 20);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-2xl font-bold tracking-tight">Todo o histórico</h1>

      {items.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<CalendarClock className="size-8" />}
            title="Nenhum treino concluído ainda"
            description="Seus treinos concluídos aparecem aqui."
          />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-2">
          {items.map((s) => (
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
