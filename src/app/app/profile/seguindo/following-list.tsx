"use client";

import Link from "next/link";
import type { GraphPerson } from "@/lib/data/social/graph";
import { FollowButton } from "@/components/social/follow-button";
import { Button } from "@/components/ui/button";
import { useKeptRows } from "../seguidores/kept-rows";
import { MoreLink, PersonLine } from "../seguidores/person-line";

/**
 * Everyone you follow, newest first, each with the follow button (unfollowing
 * asks first). Kept for the visit (useKeptRows): someone you just unfollowed
 * stays, reading "Seguir", through a server re-render that no longer lists
 * them — so a mis-tap is undone right there.
 */
export function FollowingList({ people, hasMore, page }: { people: GraphPerson[]; hasMore: boolean; page: number }) {
  const rows = useKeptRows(people);
  if (rows.length === 0) {
    return (
      <div className="mt-3 border-l-2 border-l-border-strong bg-surface-2 px-3.5 py-3 text-sm">
        <p className="font-medium">Você ainda não segue ninguém.</p>
        <p className="mt-0.5 text-muted">Os treinos de quem você segue aparecem no seu feed.</p>
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
            <FollowButton
              targetUserId={p.id}
              username={p.username}
              name={p.name}
              initialRelation={p.relation}
              isPrivate={p.isPrivate}
              size="sm"
            />
          </PersonLine>
        ))}
      </ul>
      <MoreLink shown={rows.length} hasMore={hasMore} page={page} href="/app/profile/seguindo" />
    </>
  );
}
