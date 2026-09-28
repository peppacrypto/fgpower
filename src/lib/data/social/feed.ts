import "server-only";
import { prisma } from "@/lib/db";
import { PUBLIC_USER_SELECT, toPublicUser } from "./public-user";

/** The signed-in feed: your own activities and the ones you may see from people you follow. */

export async function getFeed(userId: string, cursor?: string, pageSize = 15) {
  const following = await prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } });
  const followingIds = following.map((f) => f.followingId);

  const activities = await prisma.activity.findMany({
    where: {
      OR: [
        { userId, visibility: { in: ["PRIVATE", "FOLLOWERS", "PUBLIC"] } },
        { userId: { in: followingIds }, visibility: { in: ["FOLLOWERS", "PUBLIC"] } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: pageSize + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { user: { select: PUBLIC_USER_SELECT } },
  });

  const hasMore = activities.length > pageSize;
  const items = activities.slice(0, pageSize);

  const activityFgs = await prisma.activityFG.findMany({
    where: { activityId: { in: items.map((a) => a.id) }, userId },
    select: { activityId: true },
  });
  const givenFgActivityIds = new Set(activityFgs.map((f) => f.activityId));

  return {
    items: items.map((a) => ({ ...a, user: toPublicUser(a.user), hasGivenFg: givenFgActivityIds.has(a.id) })),
    nextCursor: hasMore ? items[items.length - 1]?.id : null,
  };
}
