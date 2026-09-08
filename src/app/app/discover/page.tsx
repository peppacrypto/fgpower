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

      <form className="mt-4" action="/app/discover">
        <Input name="q" defaultValue={q} placeholder="Buscar por nome ou usuário…" />
      </form>

      <div className="mt-6 flex flex-col gap-2">
        {q && users.length === 0 ? <p className="text-sm text-muted">Nenhum usuário encontrado.</p> : null}
        {users.map((u) => (
          <Link key={u.id} href={u.username ? `/u/${u.username}` : "#"}>
            <Card className="transition-colors hover:border-accent/50">
              <CardContent className="flex items-center gap-3 py-3.5">
                <Avatar src={u.image} name={u.name} size={40} />
                <div>
                  <p className="text-sm font-semibold">{u.name}</p>
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
