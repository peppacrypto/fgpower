import "server-only";
import { prisma } from "@/lib/db";
import { NOT_BANNED } from "@/lib/social/authorization";
import { toCardSummary } from "@/lib/social/activity-summary";
import { PUBLIC_USER_SELECT, toPublicUser } from "./public-user";

/** The signed-in feed, Today's team strip and who gave FG to a workout. */

/** Cards per "Carregar mais" step. */
export const FEED_PAGE_SIZE = 15;
/** Steps the feed grows to (8 × 15 = 120 cards); older workouts live on each profile. */
export const FEED_MAX_PAGES = 8;

/**
 * Your own activities and the ones you may see from people you follow
 * (FOLLOWERS or PUBLIC, authors not banned), newest first. `limit` grows
 * with "Carregar mais" (15 × page): the page is re-rendered whole, so there
 * is no cursor to lose on back/forward and no card twice. Ties on createdAt
 * are broken by id, so the order is the same on every render.
 */
export async function getFeed(userId: string, { limit = FEED_PAGE_SIZE }: { limit?: number } = {}) {
  const following = await prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } });
  const followingIds = following.map((f) => f.followingId);

  const activities = await prisma.activity.findMany({
    where: {
      OR: [
        { userId },
        { userId: { in: followingIds }, visibility: { in: ["FOLLOWERS", "PUBLIC"] }, user: NOT_BANNED },
      ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    include: { user: { select: PUBLIC_USER_SELECT } },
  });

  const hasMore = activities.length > limit;
  const items = activities.slice(0, limit);
  const given = await givenFgIds(userId, items.map((a) => a.id));

  return {
    items: items.map((a) => ({ ...a, user: toPublicUser(a.user), hasGivenFg: given.has(a.id) })),
    hasMore,
  };
}

/** Which of `activityIds` the viewer already gave FG to (the heart renders filled). */
export async function givenFgIds(viewerId: string | null, activityIds: string[]): Promise<Set<string>> {
  if (!viewerId || activityIds.length === 0) return new Set();
  const rows = await prisma.activityFG.findMany({
    where: { userId: viewerId, activityId: { in: activityIds } },
    select: { activityId: true },
  });
  return new Set(rows.map((r) => r.activityId));
}

/**
 * Whether the user ever gave an FG. Until they do, the first card of someone
 * else's workout explains what FG is (W-147) — no stored flag: the first FG
 * ends it for good.
 */
export async function hasEverGivenFg(userId: string): Promise<boolean> {
  const row = await prisma.activityFG.findFirst({ where: { userId }, select: { activityId: true } });
  return row !== null;
}

/** Days of the team strip's window. */
const TEAM_STRIP_DAYS = 7;
/** Workouts in the strip. */
const TEAM_STRIP_SIZE = 3;
/** Follows looked at for the strip (an upper bound, not a feature). */
const TEAM_FOLLOWING_CAP = 500;

export interface TeamStripItem {
  id: string;
  createdAt: Date;
  workoutName: string;
  fgCount: number;
  hasGivenFg: boolean;
  user: { id: string; name: string; username: string | null; image: string | null };
}

/**
 * Today's "Da sua equipe": the latest workouts (7 days) of people the user
 * follows that the user may see — FOLLOWERS or PUBLIC, authors not banned.
 * "cold" when the user follows nobody (the strip then invites instead).
 */
export async function getTeamStrip(
  userId: string,
  now: Date,
): Promise<{ kind: "cold" } | { kind: "team"; items: TeamStripItem[] }> {
  const following = await prisma.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true },
    orderBy: { createdAt: "desc" },
    take: TEAM_FOLLOWING_CAP,
  });
  if (following.length === 0) return { kind: "cold" };

  const since = new Date(now.getTime() - TEAM_STRIP_DAYS * 24 * 60 * 60 * 1000);
  const activities = await prisma.activity.findMany({
    where: {
      userId: { in: following.map((f) => f.followingId) },
      type: "WORKOUT",
      visibility: { in: ["FOLLOWERS", "PUBLIC"] },
      createdAt: { gte: since, lte: now },
      user: NOT_BANNED,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: TEAM_STRIP_SIZE,
    select: { id: true, createdAt: true, fgCount: true, summary: true, user: { select: PUBLIC_USER_SELECT } },
  });
  const given = await givenFgIds(userId, activities.map((a) => a.id));
  return {
    kind: "team",
    items: activities.map((a) => ({
      id: a.id,
      createdAt: a.createdAt,
      // Only the name crosses to the client: the stored summary may hold loads.
      workoutName: toCardSummary(a.summary).workoutName,
      fgCount: a.fgCount,
      hasGivenFg: given.has(a.id),
      user: toPublicUser(a.user),
    })),
  };
}

/**
 * Who gave FG to an activity, newest first: people the viewer can see
 * (not banned, not blocked either way). The count to show is the
 * activity's fgCount — anyone left out here is still counted there.
 */
export async function getFgGivers(activityId: string, viewerId: string | null, take = 24) {
  const rows = await prisma.activityFG.findMany({
    where: {
      activityId,
      user: {
        AND: [
          NOT_BANNED,
          viewerId
            ? { blocksMade: { none: { blockedId: viewerId } }, blocksReceived: { none: { blockerId: viewerId } } }
            : {},
        ],
      },
    },
    orderBy: [{ createdAt: "desc" }, { userId: "asc" }],
    take,
    select: { user: { select: PUBLIC_USER_SELECT } },
  });
  return rows.map((r) => toPublicUser(r.user));
}
