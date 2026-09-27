import "server-only";
import { prisma } from "@/lib/db";
import { isBlocked, isFollowing } from "@/lib/social/authorization";

/**
 * Prisma `select` for a user shown to other people. Pair with `toPublicUser`,
 * which puts the display name the user chose (Profile.displayName) in `name`
 * and falls back to the account (Google) name — so every public surface and
 * avatar shows "Carlinha", not "Carla Mendes".
 */
export const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  username: true,
  image: true,
  profile: { select: { displayName: true } },
} as const;

export function toPublicUser(user: {
  id: string;
  name: string;
  username: string | null;
  image: string | null;
  profile: { displayName: string } | null;
}) {
  return {
    id: user.id,
    name: user.profile?.displayName?.trim() || user.name,
    username: user.username,
    image: user.image,
  };
}

export type PublicUser = ReturnType<typeof toPublicUser>;

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

export async function getNotifications(userId: string) {
  const notifications = await prisma.notification.findMany({
    where: { recipientId: userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      actor: { select: PUBLIC_USER_SELECT },
      activity: { select: { id: true, sessionId: true } },
      followRequest: { select: { id: true, status: true } },
    },
  });
  return notifications.map((n) => ({ ...n, actor: n.actor ? toPublicUser(n.actor) : null }));
}

export async function getPendingFollowRequests(userId: string) {
  const requests = await prisma.followRequest.findMany({
    where: { targetId: userId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    include: { requester: { select: PUBLIC_USER_SELECT } },
  });
  return requests.map((r) => ({ ...r, requester: toPublicUser(r.requester) }));
}
