"use client";

import Link from "next/link";
import { useState } from "react";
import type { GraphPerson } from "@/lib/data/social/graph";
import type { PublicUser } from "@/lib/data/social/public-user";
import { FollowButton } from "@/components/social/follow-button";
import { Button } from "@/components/ui/button";
import { SectionHead } from "@/components/ui/section-head";
import { plural } from "@/lib/utils/format";
import { RemoveFollowerButton } from "../remove-follower-button";
import { useKeptRows } from "./kept-rows";
import { MoreLink, PersonLine } from "./person-line";
import { RequestActions } from "./request-row";

/**
 * The Seguidores page's two lists, kept for the visit (useKeptRows): a
 * request answered or a follower removed keeps its row, saying so, through
 * any server re-render — until the next visit.
 */

/** Requests waiting for an answer (a private account), nothing when there are none; the count is the server's, still waiting. */
export function RequestList({ requests }: { requests: { id: string; requester: PublicUser }[] }) {
  const rows = useKeptRows(requests);
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="solicitacoes" className="mt-8">
      <SectionHead id="solicitacoes" label="Solicitações" count={plural(requests.length, "pedido", "pedidos")} />
      <ul className="mt-2">
        {rows.map((r) => (
          <PersonLine key={r.id} person={r.requester}>
            <RequestActions requestId={r.id} name={r.requester.name} />
          </PersonLine>
        ))}
      </ul>
    </section>
  );
}

/**
 * Everyone who follows you, each with "Seguir de volta" (when you don't
 * follow them) and "Remover"; a removed follower's row is just "Removido".
 */
export function FollowerList({ people, hasMore, page }: { people: GraphPerson[]; hasMore: boolean; page: number }) {
  const rows = useKeptRows(people);
  const [removed, setRemoved] = useState<ReadonlySet<string>>(() => new Set());
  if (rows.length === 0) {
    return (
      <div className="mt-3 border-l-2 border-l-border-strong bg-surface-2 px-3.5 py-3 text-sm">
        <p className="font-medium">Ninguém segue você ainda.</p>
        <p className="mt-0.5 text-muted">Siga quem treina com você: muita gente segue de volta.</p>
        <Button variant="outline" size="sm" asChild className="mt-3">
          <Link href="/app/discover">Encontrar pessoas</Link>
        </Button>
      </div>
    );
  }
  return (
    <>
      <ul className="mt-2">
        {rows.map((p) => (
          <PersonLine key={p.id} person={p}>
            {p.relation === "NONE" && !removed.has(p.id) ? (
              <FollowButton
                targetUserId={p.id}
                username={p.username}
                name={p.name}
                initialRelation="NONE"
                isPrivate={p.isPrivate}
                size="sm"
                followLabel="Seguir de volta"
              />
            ) : null}
            <RemoveFollowerButton person={p} onRemoved={() => setRemoved((ids) => new Set(ids).add(p.id))} />
          </PersonLine>
        ))}
      </ul>
      <MoreLink shown={rows.length} hasMore={hasMore} page={page} href="/app/profile/seguidores" />
    </>
  );
}
