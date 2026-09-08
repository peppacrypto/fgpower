import "server-only";
import { prisma } from "@/lib/db";
import { isBlocked, isFollowing } from "@/lib/social/authorization";

export async function getPublicProfile(username: string, viewerId: string | null) {
  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    include: { profile: true },
  });
  if (!user || !user.profile) return null;

  if (viewerId) {
    const blocked = await isBlocked(viewerId, user.id);
    if (blocked) return null;
  }

  const [followerCount, followingCount, following, pendingRequest] = await Promise.all([
    prisma.follow.count({ where: { followingId: user.id } }),
    prisma.follow.count({ where: { followerId: user.id } }),
    viewerId ? isFollowing(viewerId, user.id) : false,
    viewerId
      ? prisma.followRequest.findUnique({
          where: { requesterId_targetId: { requesterId: viewerId, targetId: user.id } },
        })
      : null,
  ]);

  const canViewActivity = user.id === viewerId || user.profile.isPublicAccount || following;

  const activeProgram =
    user.profile.showCurrentProgram || user.id === viewerId
      ? await prisma.userProgram.findFirst({
          where: { userId: user.id, status: "ACTIVE" },
          select: { name: true },
        })
      : null;

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    image: user.image,
    bio: user.profile.bio,
    isPublicAccount: user.profile.isPublicAccount,
    followerCount,
    followingCount,
    isFollowing: following,
    hasPendingRequest: pendingRequest?.status === "PENDING",
    canViewActivity,
    activeProgramName: activeProgram?.name ?? null,
  };
}

export async function getUserPublicActivities(userId: string, viewerId: string | null, canView: boolean) {
  if (!canView) return [];
  const isOwner = userId === viewerId;
  const isFollower = viewerId ? await isFollowing(viewerId, userId) : false;

  const visibilities: ("PUBLIC" | "FOLLOWERS" | "PRIVATE")[] = isOwner
    ? ["PUBLIC", "FOLLOWERS", "PRIVATE"]
    : isFollower
      ? ["PUBLIC", "FOLLOWERS"]
      : ["PUBLIC"];

  return prisma.activity.findMany({
    where: { userId, visibility: { in: visibilities } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

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
    include: { user: { select: { id: true, name: true, username: true, image: true } } },
  });

  const hasMore = activities.length > pageSize;
  const items = activities.slice(0, pageSize);

  const activityFgs = await prisma.activityFG.findMany({
    where: { activityId: { in: items.map((a) => a.id) }, userId },
    select: { activityId: true },
  });
  const givenFgActivityIds = new Set(activityFgs.map((f) => f.activityId));

  return {
    items: items.map((a) => ({ ...a, hasGivenFg: givenFgActivityIds.has(a.id) })),
    nextCursor: hasMore ? items[items.length - 1]?.id : null,
  };
}

export async function searchUsers(query: string, viewerId: string | null) {
  const users = await prisma.user.findMany({
    where: {
      profile: { discoverable: true },
      OR: [{ username: { contains: query.toLowerCase() } }, { name: { contains: query, mode: "insensitive" } }],
    },
    take: 20,
    select: { id: true, name: true, username: true, image: true },
  });
  if (!viewerId) return users;
  const blocks = await prisma.userBlock.findMany({
    where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
  });
  const blockedIds = new Set(blocks.flatMap((b) => [b.blockerId, b.blockedId]));
  return users.filter((u) => !blockedIds.has(u.id));
}

export async function getNotifications(userId: string) {
  return prisma.notification.findMany({
    where: { recipientId: userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      actor: { select: { name: true, username: true, image: true } },
      activity: { select: { id: true, sessionId: true } },
      followRequest: { select: { id: true, status: true } },
    },
  });
}

export async function getPendingFollowRequests(userId: string) {
  return prisma.followRequest.findMany({
    where: { targetId: userId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    include: { requester: { select: { name: true, username: true, image: true } } },
  });
}
