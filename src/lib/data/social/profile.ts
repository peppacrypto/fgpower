import "server-only";
import { prisma } from "@/lib/db";
import { isBlocked, isFollowing } from "@/lib/social/authorization";

/** A person's public profile (/u/<handle>) and the activities it shows. */

export async function getPublicProfile(username: string, viewerId: string | null) {
  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    include: { profile: true },
  });
  // A banned account disappears for everyone else (lib/social/authorization).
  if (!user || !user.profile || (user.banned === true && user.id !== viewerId)) return null;

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
    name: user.profile.displayName.trim() || user.name,
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

  const activities = await prisma.activity.findMany({
    where: { userId, visibility: { in: visibilities } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  // Which of these the viewer already gave FG — so the heart renders filled
  // and a tap removes it instead of silently re-giving.
  const given = viewerId
    ? await prisma.activityFG.findMany({
        where: { userId: viewerId, activityId: { in: activities.map((a) => a.id) } },
        select: { activityId: true },
      })
    : [];
  const givenIds = new Set(given.map((f) => f.activityId));
  return activities.map((a) => ({ ...a, hasGivenFg: givenIds.has(a.id) }));
}
