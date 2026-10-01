import "server-only";
import { prisma } from "@/lib/db";
import { NOT_BANNED } from "@/lib/social/authorization";
import { loadPeople, type PersonRowData } from "@/lib/social/people";

/** Finding people (Descobrir). */

/** Rows a search shows; the query itself looks at a few more to rank them. */
const SEARCH_LIMIT = 20;
const SEARCH_CANDIDATES = 50;

/** `value` matched literally inside LIKE / ILIKE ("50%_off" has no wildcards). */
function likeContains(value: string): string {
  return `%${value.replace(/[\\%_]/g, "\\$&")}%`;
}

/**
 * People matching `query` by @handle or display name, for `viewerId`:
 * discoverable accounts with a handle, never the viewer, a banned account or
 * anyone blocked either way. Ranked: the exact @handle first, then handles
 * starting with the query, then names starting with it, then the rest
 * (newest accounts first — a friend who just joined is findable).
 *
 * The matching is a UNION of three lookups, one per column, so each can use
 * its pg_trgm GIN index (migration 20260929150000_search_trgm: user.username,
 * Profile.displayName, user.name) once the query has 3+ characters — an OR
 * across the joined tables would scan every user. Shorter queries scan,
 * which is fine at this size.
 */
export async function searchUsers(query: string, viewerId: string): Promise<PersonRowData[]> {
  // "@maria" and "maria" find the same person.
  const q = query.trim().replace(/^@+/, "").slice(0, 100);
  if (q === "") return [];
  const handle = q.toLowerCase();
  const handleLike = likeContains(handle);
  const nameLike = likeContains(q);

  const [exact, matches] = await Promise.all([
    // The exact @handle always makes the list, however many names contain it.
    prisma.user.findFirst({
      where: {
        username: handle,
        id: { not: viewerId },
        profile: { discoverable: true },
        blocksMade: { none: { blockedId: viewerId } },
        blocksReceived: { none: { blockerId: viewerId } },
        AND: [NOT_BANNED],
      },
      select: { id: true },
    }),
    prisma.$queryRaw<{ id: string }[]>`
      SELECT u.id
      FROM "user" u
      JOIN "Profile" p ON p."userId" = u.id
      WHERE u.id IN (
          SELECT id FROM "user" WHERE username LIKE ${handleLike}
          UNION
          -- The display name people see — never the Google account name
          -- behind it ("Carla Mendes" mustn't find "Carlinha")…
          SELECT "userId" FROM "Profile" WHERE "displayName" ILIKE ${nameLike}
          UNION
          -- …which only counts while no display name is set.
          SELECT u2.id FROM "user" u2 JOIN "Profile" p2 ON p2."userId" = u2.id
          WHERE p2."displayName" = '' AND u2.name ILIKE ${nameLike}
        )
        AND u.id <> ${viewerId}
        -- Only users with a public username: the rest have no page to open.
        AND u.username IS NOT NULL
        AND p.discoverable
        AND (u.banned IS NULL OR u.banned = false)
        AND NOT EXISTS (
          SELECT 1 FROM "UserBlock" b
          WHERE (b."blockerId" = u.id AND b."blockedId" = ${viewerId})
             OR (b."blockerId" = ${viewerId} AND b."blockedId" = u.id)
        )
      -- Deterministic: newest accounts first, then id.
      ORDER BY u."createdAt" DESC, u.id ASC
      LIMIT ${SEARCH_CANDIDATES}`,
  ]);

  const ids = [...new Set([...(exact ? [exact.id] : []), ...matches.map((m) => m.id)])];
  const people = await loadPeople(viewerId, ids);
  const lowerQ = q.toLocaleLowerCase("pt-BR");
  const rank = (p: PersonRowData) => {
    if (p.username === handle) return 0;
    if (p.username.startsWith(handle)) return 1;
    if (p.name.toLocaleLowerCase("pt-BR").startsWith(lowerQ)) return 2;
    return 3;
  };
  // Array.prototype.sort is stable: equal ranks keep the query's order.
  return ids
    .map((id) => people.get(id))
    .filter((p): p is PersonRowData => p !== undefined)
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, SEARCH_LIMIT);
}
