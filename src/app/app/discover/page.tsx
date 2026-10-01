import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { getOwnIdentity, getPublicProfileOrigin } from "@/lib/data/profile";
import { searchUsers } from "@/lib/data/social";
import { activeThisWeek, sameProgramPeople, type SuggestedPerson } from "@/lib/data/discover";
import { Input } from "@/components/ui/input";
import { Masthead } from "@/components/ui/masthead";
import { SectionHead } from "@/components/ui/section-head";
import { PersonRow } from "@/components/social/person-row";
import { ShareProfileButton } from "@/components/share/share-profile-button";
import { SuggestedPeople, type SuggestedRow } from "./suggested-people";
import { publicProfileLabel } from "@/lib/validation/username";
import { plural } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Descobrir" };

const LINK =
  "mt-1 inline-flex min-h-11 items-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-accent hover:underline";

export default async function DiscoverPage({ searchParams }: PageProps<"/app/discover">) {
  const [sp, user] = await Promise.all([searchParams, requireUser()]);
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100).trim() : "";

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

      {q ? <SearchResults q={q} viewerId={user.id} /> : <Suggestions viewerId={user.id} />}
    </div>
  );
}

async function SearchResults({ q, viewerId }: { q: string; viewerId: string }) {
  const people = await searchUsers(q, viewerId);
  if (people.length === 0) {
    return (
      <p className="mt-6 text-sm text-muted" role="status">
        Ninguém encontrado para “{q}”. Tente o nome ou o @usuário exato — contas que desligaram a descoberta não
        aparecem.
      </p>
    );
  }
  return (
    <section className="mt-8" aria-labelledby="resultados">
      <SectionHead id="resultados" label="Resultados" count={plural(people.length, "pessoa", "pessoas")} />
      <div className="mt-4 flex flex-col gap-2">
        {people.map((p) => (
          <PersonRow key={p.id} person={p} meta={p.programName ? `Treinando: ${p.programName}` : null} />
        ))}
      </div>
    </section>
  );
}

/** A suggestion as its row shows it (only that crosses to the client). */
function toRow({ person, meta }: SuggestedPerson): SuggestedRow {
  const { id, name, username, image, bio, isPublicAccount, relation } = person;
  return { person: { id, name, username, image, bio, isPublicAccount, relation }, meta };
}

/** Before a search: people to follow (same program, active this week) and a way to bring a friend. */
async function Suggestions({ viewerId }: { viewerId: string }) {
  const [sameProgram, me, origin] = await Promise.all([
    sameProgramPeople(viewerId),
    getOwnIdentity(viewerId),
    getPublicProfileOrigin(),
  ]);
  // Nobody twice on the page: "Ativos" skips who "Mesmo programa" already shows.
  const active = await activeThisWeek(viewerId, { skip: sameProgram.map((s) => s.person.id) });

  return (
    <>
      <div className="mt-6 border-l-2 border-l-border-strong bg-surface-2 px-3.5 py-3 text-sm">
        <p className="font-medium">Encontre amigos pelo nome ou @usuário.</p>
        <p className="mt-0.5 text-muted">Só aparecem contas com a descoberta ligada.</p>
        <Link href="/app/settings#privacidade" className={LINK}>
          Como te encontram
        </Link>
      </div>

      <SuggestedPeople sameProgram={sameProgram.map(toRow)} active={active.map(toRow)} />

      <section className="mt-8" aria-labelledby="convide">
        <SectionHead id="convide" label="Convide um amigo" />
        <div className="mt-4 border-l-2 border-l-accent bg-surface-2 px-3.5 py-3.5">
          <p className="font-semibold">Treinar junto rende mais.</p>
          <p className="mt-0.5 text-sm text-muted">
            Mande seu perfil para quem treina com você — quando a pessoa entrar, é só seguir.
          </p>
          {me?.username ? (
            <>
              <ShareProfileButton username={me.username} name={me.name} className="mt-3" />
              <p className="mt-2 break-all font-mono text-[11px] text-muted">{publicProfileLabel(me.username, origin)}</p>
            </>
          ) : (
            <Link href="/app/settings#usuario" className={LINK}>
              Escolha seu @usuário
            </Link>
          )}
        </div>
      </section>
    </>
  );
}
