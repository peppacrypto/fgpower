import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { isShareToken } from "@/lib/social/share-token";

/**
 * Central authorization helpers for the social layer (spec §46.19). Every
 * activity/profile read that crosses a user boundary must go through one of
 * these — never trust a hidden button alone.
 */

/**
 * Users who aren't banned, for list queries (feed, search, Descobrir, FG
 * givers…): `where: { user: NOT_BANNED }`, or `AND: [NOT_BANNED]` next to
 * other OR clauses. User.banned is nullable, and `NOT: { banned: true }` /
 * `banned: { not: true }` both drop NULL rows in SQL — hence the explicit OR.
 */
export const NOT_BANNED = { OR: [{ banned: null }, { banned: false }] } satisfies Prisma.UserWhereInput;

/**
 * A banned account disappears for everyone else (its owner's data stays; an
 * unban restores it). One indexed lookup.
 */
export async function isBannedUser(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { banned: true } });
  return user?.banned === true;
}

export async function isBlocked(userA: string, userB: string): Promise<boolean> {
  if (userA === userB) return false;
  const block = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: userA, blockedId: userB },
        { blockerId: userB, blockedId: userA },
      ],
    },
  });
  return Boolean(block);
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const row = await prisma.follow.findUnique({ where: { followerId_followingId: { followerId, followingId } } });
  return Boolean(row);
}

export async function canViewProfile(viewerId: string | null, profileUserId: string): Promise<boolean> {
  if (viewerId === profileUserId) return true;
  if (viewerId) {
    const blocked = await isBlocked(viewerId, profileUserId);
    if (blocked) return false;
  }
  if (await isBannedUser(profileUserId)) return false;
  const profile = await prisma.profile.findUnique({ where: { userId: profileUserId }, select: { isPublicAccount: true } });
  if (!profile) return false;
  if (profile.isPublicAccount) return true;
  if (!viewerId) return false;
  return isFollowing(viewerId, profileUserId);
}

/**
 * Authoritative check for whether `viewerId` (null = anonymous) may see one
 * activity in the app, honoring visibility, ownership, follow status, private
 * accounts, blocks and bans. Always call this before returning activity data.
 * A share link is a separate grant: see activityAccess.
 */
export async function canViewActivity(
  viewerId: string | null,
  activity: { userId: string; visibility: "PRIVATE" | "FOLLOWERS" | "PUBLIC" },
): Promise<boolean> {
  if (viewerId === activity.userId) return true;
  if (activity.visibility === "PRIVATE") return false;
  if (viewerId && (await isBlocked(viewerId, activity.userId))) return false;
  if (await isBannedUser(activity.userId)) return false;
  if (!viewerId) return activity.visibility === "PUBLIC";

  if (activity.visibility === "PUBLIC") return true;
  // FOLLOWERS: must actively follow, AND if the author's account is private,
  // that follow must exist (private accounts never leak followers-only
  // content to non-followers regardless of the activity's own flag).
  return isFollowing(viewerId, activity.userId);
}

/**
 * How a viewer may see one activity:
 * - "owner": their own;
 * - "in-app": canViewActivity allows it (the full page, FG, report);
 * - "link-only": only through its share link (/t/<token>) — that one workout,
 *   read-only, whatever its visibility; nothing else about the author opens;
 * - "none": not at all (blocked either way, banned author, revoked link…).
 * `token` is the one in the URL. Activity.shareToken is omitted from rows by
 * default (lib/db.ts), so the link is checked here by id + token.
 */
export type ActivityAccess = "owner" | "in-app" | "link-only" | "none";

export async function activityAccess(
  viewerId: string | null,
  activity: { id: string; userId: string; visibility: "PRIVATE" | "FOLLOWERS" | "PUBLIC" },
  token?: string | null,
): Promise<ActivityAccess> {
  if (viewerId === activity.userId) return "owner";
  if (await canViewActivity(viewerId, activity)) return "in-app";
  // Anything that isn't a token's shape is no link (and costs no lookup).
  if (!isShareToken(token)) return "none";
  // canViewActivity said no: rule out the reasons a link doesn't override.
  if (viewerId && (await isBlocked(viewerId, activity.userId))) return "none";
  if (await isBannedUser(activity.userId)) return "none";
  const linked = await prisma.activity.count({ where: { id: activity.id, shareToken: token } });
  return linked > 0 ? "link-only" : "none";
}
