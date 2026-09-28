import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { searchUsers } from "@/lib/data/social";
import { Avatar } from "@/components/ui/misc";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = { title: "Descobrir" };

export default async function DiscoverPage({ searchParams }: PageProps<"/app/discover">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const user = await requireUser();
  const users = q ? await searchUsers(q, user.id) : [];

  return (
    <div className="mx-auto max-w-xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-2xl font-bold tracking-tight">Descobrir</h1>

      <form className="mt-4" action="/app/discover" role="search">
        <Input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar por nome ou @usuário…"
          aria-label="Buscar pessoas por nome ou @usuário"
        />
      </form>

      <div className="mt-6 flex flex-col gap-2">
        {!q ? (
          // Before a search: what can be found here, and how to be found.
          <div className="border-l-2 border-l-border-strong bg-surface-2 px-3.5 py-3 text-sm">
            <p className="font-medium">Encontre amigos pelo nome ou @usuário.</p>
            <p className="mt-0.5 text-muted">
              Só aparecem contas que deixaram a descoberta ligada. Seus treinos continuam privados até você compartilhar um.
            </p>
            <Link
              href="/app/settings#privacidade"
              className="mt-1 inline-flex min-h-11 items-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-accent hover:underline"
            >
              Como te encontram
            </Link>
          </div>
        ) : null}
        {q && users.length === 0 ? (
          <p className="text-sm text-muted">
            Ninguém encontrado para “{q}”. Tente o nome ou o @usuário exato — contas que desligaram a descoberta não
            aparecem.
          </p>
        ) : null}
        {users.map((u) => (
          <Link key={u.id} href={u.username ? `/u/${u.username}` : "#"}>
            <Card className="transition-colors hover:border-accent/50">
              <CardContent className="flex items-center gap-3 py-3.5">
                <Avatar src={u.image} name={u.name} size={40} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{u.name}</p>
                  {u.username ? <p className="text-xs text-muted">@{u.username}</p> : null}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
