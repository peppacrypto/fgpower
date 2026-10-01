import "server-only";
import { prisma } from "@/lib/db";
import { NOT_BANNED } from "@/lib/social/authorization";
import { PUBLIC_USER_SELECT, toPublicUser, type PublicUser } from "./public-user";

/**
 * Who follows whom, for the account's own lists (W-141): requests waiting for
 * an answer, followers, following, blocked accounts. Banned people are left
 * out everywhere (they disappear for everyone else; an unban brings them back).
 */

/** A person in one of your lists, with what the row's buttons need. */
export interface GraphPerson extends PublicUser {
  /** A private account: following them is a request. */
  isPrivate: boolean;
  /** You → them. */
  relation: "NONE" | "REQUESTED" | "FOLLOWING";
}

export interface GraphPage {
  people: GraphPerson[];
  /** More beyond `limit` ("Carregar mais"). */
  hasMore: boolean;
  /** Everyone in the list (the section's count). */
  total: number;
}

const PERSON_SELECT = {
  ...PUBLIC_USER_SELECT,
  profile: { select: { displayName: true, isPublicAccount: true } },
} as const;

type PersonRow = {
  id: string;
  name: string;
  username: string | null;
  image: string | null;
  profile: { displayName: string; isPublicAccount: boolean } | null;
};

async function withRelations(viewerId: string, users: PersonRow[]): Promise<GraphPerson[]> {
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return [];
  const [following, requested] = await Promise.all([
    prisma.follow.findMany({ where: { followerId: viewerId, followingId: { in: ids } }, select: { followingId: true } }),
    prisma.followRequest.findMany({
      where: { requesterId: viewerId, targetId: { in: ids }, status: "PENDING" },
      select: { targetId: true },
    }),
  ]);
  const followingSet = new Set(following.map((f) => f.followingId));
  const requestedSet = new Set(requested.map((r) => r.targetId));
  return users.map((u) => ({
    ...toPublicUser(u),
    isPrivate: u.profile?.isPublicAccount === false,
    relation: followingSet.has(u.id) ? "FOLLOWING" : requestedSet.has(u.id) ? "REQUESTED" : "NONE",
  }));
}

/** People following `userId`, newest first. */
export async function getFollowers(userId: string, limit: number): Promise<GraphPage> {
  const where = { followingId: userId, follower: NOT_BANNED };
  const [rows, total] = await Promise.all([
    prisma.follow.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { followerId: "desc" }],
      take: limit + 1,
      select: { follower: { select: PERSON_SELECT } },
    }),
    prisma.follow.count({ where }),
  ]);
  const people = await withRelations(
    userId,
    rows.slice(0, limit).map((r) => r.follower),
  );
  return { people, hasMore: rows.length > limit, total };
}

/** People `userId` follows, newest first. */
export async function getFollowing(userId: string, limit: number): Promise<GraphPage> {
  const where = { followerId: userId, following: NOT_BANNED };
  const [rows, total] = await Promise.all([
    prisma.follow.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { followingId: "desc" }],
      take: limit + 1,
      select: { following: { select: PERSON_SELECT } },
    }),
    prisma.follow.count({ where }),
  ]);
  const people = await withRelations(
    userId,
    rows.slice(0, limit).map((r) => r.following),
  );
  return { people, hasMore: rows.length > limit, total };
}

/** Requests waiting for `userId`'s answer, newest first (at most 50). */
export async function getPendingFollowRequests(userId: string) {
  const requests = await prisma.followRequest.findMany({
    where: { targetId: userId, status: "PENDING", requester: NOT_BANNED },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 50,
    include: { requester: { select: PUBLIC_USER_SELECT } },
  });
  return requests.map((r) => ({ ...r, requester: toPublicUser(r.requester) }));
}

/** The counts on /app/profile: followers, following and requests waiting. */
export async function getGraphCounts(userId: string) {
  const [followers, following, requests] = await Promise.all([
    prisma.follow.count({ where: { followingId: userId, follower: NOT_BANNED } }),
    prisma.follow.count({ where: { followerId: userId, following: NOT_BANNED } }),
    prisma.followRequest.count({ where: { targetId: userId, status: "PENDING", requester: NOT_BANNED } }),
  ]);
  return { followers, following, requests };
}

/** Accounts `userId` blocked, most recent first. */
export async function getBlockedUsers(userId: string): Promise<PublicUser[]> {
  const rows = await prisma.userBlock.findMany({
    where: { blockerId: userId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { blocked: { select: PUBLIC_USER_SELECT } },
  });
  return rows.map((r) => toPublicUser(r.blocked));
}
