import "server-only";
import { prisma } from "@/lib/db";
import { NOT_BANNED } from "@/lib/social/authorization";
import type { FollowRelation } from "@/components/social/follow-button";

/**
 * People shown as rows (Descobrir's search and suggestions): who they are,
 * what they train and where the viewer stands with them, so a row can follow
 * straight away instead of detouring through /u. Server-only.
 */

// The one definition lives in authorization.ts; re-exported for list queries here.
export { NOT_BANNED };

export interface PersonRowData {
  id: string;
  /** Display name (Profile.displayName), else the account name. */
  name: string;
  username: string;
  image: string | null;
  /** The bio, trimmed to one short line's worth. */
  bio: string | null;
  isPublicAccount: boolean;
  /** Their ACTIVE program's name, only when they show it (Profile.showCurrentProgram). */
  programName: string | null;
  relation: FollowRelation;
  /** They follow the viewer. */
  followsYou: boolean;
}

/** A bio is one truncated line in a row: no need to ship a long one. */
const BIO_MAX = 90;

/** Who a viewer never sees in suggestions: blocks either way, and the people already followed or asked. */
export async function socialExclusions(viewerId: string): Promise<{
  blocked: Set<string>;
  following: Set<string>;
  requested: Set<string>;
}> {
  const [blocks, follows, requests] = await Promise.all([
    prisma.userBlock.findMany({
      where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
      select: { blockerId: true, blockedId: true },
    }),
    prisma.follow.findMany({ where: { followerId: viewerId }, select: { followingId: true } }),
    prisma.followRequest.findMany({
      where: { requesterId: viewerId, status: "PENDING" },
      select: { targetId: true },
    }),
  ]);
  return {
    blocked: new Set(blocks.map((b) => (b.blockerId === viewerId ? b.blockedId : b.blockerId))),
    following: new Set(follows.map((f) => f.followingId)),
    requested: new Set(requests.map((r) => r.targetId)),
  };
}

/**
 * Row data for `userIds`, keyed by id (3 queries). Users without a handle,
 * without a profile or banned are left out — they have no page to open.
 */
export async function loadPeople(viewerId: string, userIds: string[]): Promise<Map<string, PersonRowData>> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map();
  const [users, follows, requests] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: ids }, username: { not: null }, AND: [NOT_BANNED] },
      select: {
        id: true,
        name: true,
        username: true,
        image: true,
        profile: { select: { displayName: true, bio: true, isPublicAccount: true, showCurrentProgram: true } },
        programs: { where: { status: "ACTIVE" }, orderBy: { updatedAt: "desc" }, take: 1, select: { name: true } },
      },
    }),
    prisma.follow.findMany({
      where: {
        OR: [
          { followerId: viewerId, followingId: { in: ids } },
          { followerId: { in: ids }, followingId: viewerId },
        ],
      },
      select: { followerId: true, followingId: true },
    }),
    prisma.followRequest.findMany({
      where: { requesterId: viewerId, targetId: { in: ids }, status: "PENDING" },
      select: { targetId: true },
    }),
  ]);
  const following = new Set(follows.filter((f) => f.followerId === viewerId).map((f) => f.followingId));
  const followers = new Set(follows.filter((f) => f.followingId === viewerId).map((f) => f.followerId));
  const requested = new Set(requests.map((r) => r.targetId));

  const people = new Map<string, PersonRowData>();
  for (const u of users) {
    if (!u.profile || !u.username) continue;
    const bio = u.profile.bio?.trim() || null;
    people.set(u.id, {
      id: u.id,
      name: u.profile.displayName.trim() || u.name,
      username: u.username,
      image: u.image,
      bio: bio && bio.length > BIO_MAX ? `${bio.slice(0, BIO_MAX - 1).trimEnd()}…` : bio,
      isPublicAccount: u.profile.isPublicAccount,
      programName: u.profile.showCurrentProgram ? (u.programs[0]?.name ?? null) : null,
      relation: following.has(u.id) ? "FOLLOWING" : requested.has(u.id) ? "REQUESTED" : "NONE",
      followsYou: followers.has(u.id),
    });
  }
  return people;
}
