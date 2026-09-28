import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { searchUsers } from "@/lib/data/social";
import { Avatar } from "@/components/ui/misc";
import { GArrow } from "@/components/ui/glyph";
import { Input } from "@/components/ui/input";
import { Masthead } from "@/components/ui/masthead";
import { SectionHead } from "@/components/ui/section-head";
import { plural } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Descobrir" };

export default async function DiscoverPage({ searchParams }: PageProps<"/app/discover">) {
  const [sp, user] = await Promise.all([searchParams, requireUser()]);
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";
  const users = q ? await searchUsers(q, user.id) : [];

  return (
    <div className="mx-auto max-w-xl px-4 py-6 sm:px-6 sm:py-8">
      <Masthead kicker="Encontre atletas" title="Descobrir" />

      <form className="mt-4" action="/app/discover" role="search">
        <Input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar por nome ou @usuário…"
          aria-label="Buscar pessoas por nome ou @usuário"
        />
      </form>

      {q && users.length > 0 ? (
        <SectionHead className="mt-8" label="Resultados" count={plural(users.length, "pessoa", "pessoas")} />
      ) : null}
      <div className={q && users.length > 0 ? "mt-4 flex flex-col gap-2" : "mt-6 flex flex-col gap-2"}>
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
          <Link
            key={u.id}
            href={u.username ? `/u/${u.username}` : "#"}
            className="reg-frame is-link group flex items-center gap-3 px-5 py-3.5"
          >
            <Avatar src={u.image} name={u.name} size={40} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold group-hover:text-accent">{u.name}</span>
              {u.username ? <span className="block font-mono text-xs text-muted">@{u.username}</span> : null}
            </span>
            <GArrow aria-hidden className="size-3.5 shrink-0 text-muted" />
          </Link>
        ))}
      </div>
    </div>
  );
}
