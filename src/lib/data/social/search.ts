import "server-only";
import { prisma } from "@/lib/db";
import { PUBLIC_USER_SELECT, toPublicUser } from "./public-user";

/** Finding people (Descobrir). */

export async function searchUsers(query: string, viewerId: string | null) {
  // "@maria" and "maria" find the same person.
  const q = query.trim().replace(/^@+/, "");
  if (q === "") return [];
  const users = await prisma.user.findMany({
    where: {
      profile: { discoverable: true },
      // Only surface users with a public username — the rest have no openable
      // profile, so their cards would be dead taps (href="#").
      username: { not: null },
      // By @handle and the display name people see — never by the Google
      // account name hidden behind it ("Carla Mendes" mustn't find
      // "Carlinha"). The account name only counts while no display name is set.
      OR: [
        { username: { contains: q.toLowerCase() } },
        { profile: { displayName: { contains: q, mode: "insensitive" } } },
        { AND: [{ profile: { displayName: "" } }, { name: { contains: q, mode: "insensitive" } }] },
      ],
    },
    // Newest accounts first among the capped matches (a friend who just joined
    // is findable); without an order Prisma sorts by the random user id.
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: 20,
    select: PUBLIC_USER_SELECT,
  });
  const people = users.map(toPublicUser);
  if (!viewerId) return people;
  const blocks = await prisma.userBlock.findMany({
    where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
  });
  const blockedIds = new Set(blocks.flatMap((b) => [b.blockerId, b.blockedId]));
  return people.filter((u) => !blockedIds.has(u.id));
}
