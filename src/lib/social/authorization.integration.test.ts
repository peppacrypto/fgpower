import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { activityAccess, canViewActivity, canViewProfile, isBannedUser, isBlocked, isFollowing, NOT_BANNED } from "./authorization";
import { newShareToken } from "./share-token";

/**
 * Integration tests against the real local Postgres (spec §46.20). These
 * exercise the exact authorization logic every activity/profile read goes
 * through — the thing standing between a user and someone else's private
 * training data.
 */

const RUN_ID = `authz-${Date.now()}`;
const userIds: string[] = [];

async function makeUser(label: string, isPublicAccount: boolean) {
  const id = `${RUN_ID}-${label}`;
  await prisma.user.create({
    data: { id, name: label, email: `${id}@fgpower.test`, emailVerified: true },
  });
  await prisma.profile.create({ data: { userId: id, displayName: label, isPublicAccount } });
  userIds.push(id);
  return id;
}

let publicUser: string, privateUser: string, follower: string, stranger: string, blocker: string, blocked: string, banned: string;

beforeAll(async () => {
  publicUser = await makeUser("public", true);
  privateUser = await makeUser("private", false);
  follower = await makeUser("follower", true);
  stranger = await makeUser("stranger", true);
  blocker = await makeUser("blocker", true);
  blocked = await makeUser("blocked", true);
  banned = await makeUser("banned", true);
  await prisma.user.update({ where: { id: banned }, data: { banned: true, banReason: "test" } });

  await prisma.follow.create({ data: { followerId: follower, followingId: privateUser } });
  await prisma.userBlock.create({ data: { blockerId: blocker, blockedId: blocked } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe("isBlocked", () => {
  it("is true in either direction", async () => {
    expect(await isBlocked(blocker, blocked)).toBe(true);
    expect(await isBlocked(blocked, blocker)).toBe(true);
  });
  it("is false for unrelated users", async () => {
    expect(await isBlocked(publicUser, stranger)).toBe(false);
  });
  it("is false for a user against themself", async () => {
    expect(await isBlocked(publicUser, publicUser)).toBe(false);
  });
});

describe("isFollowing", () => {
  it("reflects a real follow row", async () => {
    expect(await isFollowing(follower, privateUser)).toBe(true);
    expect(await isFollowing(stranger, privateUser)).toBe(false);
  });
});

describe("canViewProfile", () => {
  it("a public account is visible to anyone, including anonymous viewers", async () => {
    expect(await canViewProfile(null, publicUser)).toBe(true);
    expect(await canViewProfile(stranger, publicUser)).toBe(true);
  });
  it("a private account is hidden from a non-follower", async () => {
    expect(await canViewProfile(stranger, privateUser)).toBe(false);
    expect(await canViewProfile(null, privateUser)).toBe(false);
  });
  it("a private account is visible to a follower", async () => {
    expect(await canViewProfile(follower, privateUser)).toBe(true);
  });
  it("the owner can always view their own profile, public or private", async () => {
    expect(await canViewProfile(privateUser, privateUser)).toBe(true);
  });
});

describe("canViewActivity", () => {
  it("a PRIVATE activity is visible only to its owner", async () => {
    const activity = { userId: publicUser, visibility: "PRIVATE" as const };
    expect(await canViewActivity(publicUser, activity)).toBe(true);
    expect(await canViewActivity(stranger, activity)).toBe(false);
    expect(await canViewActivity(null, activity)).toBe(false);
  });

  it("a PUBLIC activity is visible to anyone, including anonymous viewers", async () => {
    const activity = { userId: publicUser, visibility: "PUBLIC" as const };
    expect(await canViewActivity(stranger, activity)).toBe(true);
    expect(await canViewActivity(null, activity)).toBe(true);
  });

  it("a FOLLOWERS activity is visible only to an actual follower", async () => {
    const activity = { userId: privateUser, visibility: "FOLLOWERS" as const };
    expect(await canViewActivity(follower, activity)).toBe(true);
    expect(await canViewActivity(stranger, activity)).toBe(false);
    expect(await canViewActivity(null, activity)).toBe(false);
  });

  it("a blocked viewer cannot see even a PUBLIC activity", async () => {
    const activity = { userId: blocker, visibility: "PUBLIC" as const };
    expect(await canViewActivity(blocked, activity)).toBe(false);
  });
});

describe("banned authors", () => {
  it("disappear for everyone but themselves", async () => {
    expect(await isBannedUser(banned)).toBe(true);
    expect(await isBannedUser(publicUser)).toBe(false);
    expect(await canViewProfile(stranger, banned)).toBe(false);
    expect(await canViewProfile(null, banned)).toBe(false);
    expect(await canViewProfile(banned, banned)).toBe(true);
    const activity = { userId: banned, visibility: "PUBLIC" as const };
    expect(await canViewActivity(stranger, activity)).toBe(false);
    expect(await canViewActivity(null, activity)).toBe(false);
    expect(await canViewActivity(banned, activity)).toBe(true);
  });

  it("NOT_BANNED keeps users whose banned flag is false or NULL", async () => {
    await prisma.user.update({ where: { id: stranger }, data: { banned: null } });
    try {
      const rows = await prisma.user.findMany({ where: { id: { in: userIds }, AND: [NOT_BANNED] }, select: { id: true } });
      const ids = rows.map((r) => r.id);
      expect(ids).toContain(stranger);
      expect(ids).toContain(publicUser);
      expect(ids).not.toContain(banned);
    } finally {
      await prisma.user.update({ where: { id: stranger }, data: { banned: false } });
    }
  });
});

describe("activityAccess", () => {
  async function makeActivity(userId: string, visibility: "PRIVATE" | "FOLLOWERS" | "PUBLIC", shareToken: string | null) {
    return prisma.activity.create({
      data: { userId, type: "WORKOUT", visibility, summary: {}, shareToken, sharedAt: shareToken ? new Date() : null },
      select: { id: true, userId: true, visibility: true },
    });
  }

  it("owner, in-app, link-only and none", async () => {
    const token = newShareToken();
    const privateLinked = await makeActivity(privateUser, "PRIVATE", token);
    expect(await activityAccess(privateUser, privateLinked)).toBe("owner");
    expect(await activityAccess(stranger, privateLinked)).toBe("none");
    expect(await activityAccess(stranger, privateLinked, token)).toBe("link-only");
    expect(await activityAccess(null, privateLinked, token)).toBe("link-only");
    expect(await activityAccess(null, privateLinked, newShareToken())).toBe("none");
    // Not a token's shape: never looked up.
    expect(await activityAccess(null, privateLinked, `${token}x`)).toBe("none");
    expect(await activityAccess(null, privateLinked, "")).toBe("none");

    const followers = await makeActivity(privateUser, "FOLLOWERS", null);
    expect(await activityAccess(follower, followers)).toBe("in-app");
    expect(await activityAccess(stranger, followers)).toBe("none");
  });

  it("a link never opens a blocked pair or a banned author", async () => {
    const token = newShareToken();
    const blockerPost = await makeActivity(blocker, "PRIVATE", token);
    expect(await activityAccess(blocked, blockerPost, token)).toBe("none");
    expect(await activityAccess(stranger, blockerPost, token)).toBe("link-only");

    const bannedToken = newShareToken();
    const bannedPost = await makeActivity(banned, "PUBLIC", bannedToken);
    expect(await activityAccess(null, bannedPost, bannedToken)).toBe("none");
  });

  it("a revoked link (token cleared) opens nothing", async () => {
    const token = newShareToken();
    const post = await makeActivity(publicUser, "PRIVATE", token);
    await prisma.activity.update({ where: { id: post.id }, data: { shareToken: null, sharedAt: null } });
    expect(await activityAccess(stranger, post, token)).toBe("none");
  });

  it("rows never carry the token unless a query selects it", async () => {
    const token = newShareToken();
    const post = await makeActivity(publicUser, "PUBLIC", token);
    const row = await prisma.activity.findUniqueOrThrow({ where: { id: post.id } });
    expect("shareToken" in row).toBe(false);
    const selected = await prisma.activity.findUniqueOrThrow({ where: { id: post.id }, select: { shareToken: true } });
    expect(selected.shareToken).toBe(token);
  });
});
