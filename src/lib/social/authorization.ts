import "server-only";
import { prisma } from "@/lib/db";

/**
 * Central authorization helpers for the social layer (spec §46.19). Every
 * activity/profile read that crosses a user boundary must go through one of
 * these — never trust a hidden button alone.
 */

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
  const profile = await prisma.profile.findUnique({ where: { userId: profileUserId }, select: { isPublicAccount: true } });
  if (!profile) return false;
  if (profile.isPublicAccount) return true;
  if (!viewerId) return false;
  return isFollowing(viewerId, profileUserId);
}

/**
 * Authoritative check for whether `viewerId` (null = anonymous) may see one
 * activity, honoring visibility, ownership, follow status, private accounts,
 * and blocks. Always call this before returning activity data.
 */
export async function canViewActivity(
  viewerId: string | null,
  activity: { userId: string; visibility: "PRIVATE" | "FOLLOWERS" | "PUBLIC" },
): Promise<boolean> {
  if (viewerId === activity.userId) return true;
  if (activity.visibility === "PRIVATE") return false;
  if (!viewerId) return activity.visibility === "PUBLIC";

  const blocked = await isBlocked(viewerId, activity.userId);
  if (blocked) return false;

  if (activity.visibility === "PUBLIC") return true;
  // FOLLOWERS: must actively follow, AND if the author's account is private,
  // that follow must exist (private accounts never leak followers-only
  // content to non-followers regardless of the activity's own flag).
  return isFollowing(viewerId, activity.userId);
}
