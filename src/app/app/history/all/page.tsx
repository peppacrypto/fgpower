import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { listAllSessions } from "@/lib/data/history";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Todo o histórico" };

export default async function AllHistoryPage({ searchParams }: PageProps<"/app/history/all">) {
  const sp = await searchParams;
  const page = typeof sp.page === "string" ? Number(sp.page) : 1;
  const user = await requireUser();
  const { items, totalPages } = await listAllSessions(user.id, page, 20);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-2xl font-bold tracking-tight">Todo o histórico</h1>

      <div className="mt-6 flex flex-col gap-2">
        {items.map((s) => (
          <Link key={s.id} href={`/app/workout/${s.id}/summary`}>
            <Card className="transition-colors hover:border-accent/50">
              <CardContent className="flex items-center justify-between py-3.5">
                <div>
                  <p className="text-sm font-semibold">{s.name}</p>
                  <p className="text-xs text-muted">
                    {s.finishedAt?.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </div>
                <p className="text-xs text-muted">{s.totalWorkingSets ?? 0} séries</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

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
