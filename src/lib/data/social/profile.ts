import "server-only";
import { prisma } from "@/lib/db";
import { NOT_BANNED, isBlocked, isFollowing } from "@/lib/social/authorization";
import { givenFgIds } from "./feed";

/** A person's public profile (/u/<handle>) and the activities it shows. */

export async function getPublicProfile(username: string, viewerId: string | null) {
  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    include: { profile: true },
  });
  // A banned account disappears for everyone else (lib/social/authorization).
  if (!user || !user.profile || (user.banned === true && user.id !== viewerId)) return null;
  const isOwner = user.id === viewerId;

  if (viewerId && !isOwner) {
    const blocked = await isBlocked(viewerId, user.id);
    if (blocked) return null;
  }

  const showProgram = user.profile.showCurrentProgram || isOwner;
  const [followerCount, followingCount, following, pendingRequest, followsViewer, activeProgram, viewerProgram] =
    await Promise.all([
      // Banned accounts aren't counted — the owner's lists (/app/profile/seguidores) leave them out too.
      prisma.follow.count({ where: { followingId: user.id, follower: NOT_BANNED } }),
      prisma.follow.count({ where: { followerId: user.id, following: NOT_BANNED } }),
      viewerId && !isOwner ? isFollowing(viewerId, user.id) : false,
      viewerId && !isOwner
        ? prisma.followRequest.findUnique({
            where: { requesterId_targetId: { requesterId: viewerId, targetId: user.id } },
          })
        : null,
      viewerId && !isOwner ? isFollowing(user.id, viewerId) : false,
      showProgram
        ? prisma.userProgram.findFirst({
            where: { userId: user.id, status: "ACTIVE" },
            orderBy: { updatedAt: "desc" },
            select: { name: true, sourceTemplate: { select: { slug: true, isPublished: true } } },
          })
        : null,
      // The viewer's own program, for "Vocês treinam o mesmo programa".
      viewerId && !isOwner
        ? prisma.userProgram.findFirst({
            where: { userId: viewerId, status: "ACTIVE" },
            orderBy: { updatedAt: "desc" },
            select: { sourceTemplate: { select: { slug: true } } },
          })
        : null,
    ]);

  const canViewActivity = isOwner || user.profile.isPublicAccount || following;
  // A program forked from a published template links to its dossier (W-146).
  const templateSlug = activeProgram?.sourceTemplate?.isPublished ? activeProgram.sourceTemplate.slug : null;

  return {
    id: user.id,
    name: user.profile.displayName.trim() || user.name,
    username: user.username,
    image: user.image,
    bio: user.profile.bio,
    isPublicAccount: user.profile.isPublicAccount,
    /** Appears in search and Descobrir; with a public account, the page may be indexed. */
    discoverable: user.profile.discoverable,
    followerCount,
    followingCount,
    isFollowing: following,
    hasPendingRequest: pendingRequest?.status === "PENDING",
    /** They follow the viewer ("Remover dos seguidores" in the ⋯ menu). */
    followsViewer,
    canViewActivity,
    activeProgramName: activeProgram?.name ?? null,
    /** The published template the shown program comes from, else null (a custom program). */
    activeProgramTemplateSlug: templateSlug,
    /** A signed-in viewer runs a program from the same template. */
    sameProgramAsViewer: Boolean(templateSlug && viewerProgram?.sourceTemplate?.slug === templateSlug),
    /** Only for the owner: how their new workouts are published (the empty state explains it). */
    defaultWorkoutVisibility: isOwner ? user.profile.defaultWorkoutVisibility : null,
  };
}

export type PublicProfile = NonNullable<Awaited<ReturnType<typeof getPublicProfile>>>;

/** Cards per "Carregar mais" step on a profile. */
export const PROFILE_PAGE_SIZE = 20;
/** Steps a profile grows to (6 × 20 = 120 cards). */
export const PROFILE_MAX_PAGES = 6;

/**
 * The activities a viewer may see on a profile, newest first (ties by id),
 * up to `limit`, and whether there are more: everything for the owner,
 * FOLLOWERS and PUBLIC for a follower, PUBLIC for anyone else — nothing when
 * the viewer can't see the account's activity at all.
 */
export async function getProfileActivities(
  userId: string,
  viewerId: string | null,
  canView: boolean,
  { limit = PROFILE_PAGE_SIZE }: { limit?: number } = {},
) {
  if (!canView) return { items: [], hasMore: false };
  const isOwner = userId === viewerId;
  const isFollower = viewerId && !isOwner ? await isFollowing(viewerId, userId) : false;

  const visibilities: ("PUBLIC" | "FOLLOWERS" | "PRIVATE")[] = isOwner
    ? ["PUBLIC", "FOLLOWERS", "PRIVATE"]
    : isFollower
      ? ["PUBLIC", "FOLLOWERS"]
      : ["PUBLIC"];

  const activities = await prisma.activity.findMany({
    where: { userId, visibility: { in: visibilities } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });
  const items = activities.slice(0, limit);
  // Which of these the viewer already gave FG — so the heart renders filled
  // and a tap removes it instead of silently re-giving.
  const given = await givenFgIds(viewerId, items.map((a) => a.id));
  return {
    items: items.map((a) => ({ ...a, hasGivenFg: given.has(a.id) })),
    hasMore: activities.length > limit,
  };
}

/** The first page of a profile's activities (kept for callers that don't paginate). */
export async function getUserPublicActivities(userId: string, viewerId: string | null, canView: boolean) {
  return (await getProfileActivities(userId, viewerId, canView)).items;
}
