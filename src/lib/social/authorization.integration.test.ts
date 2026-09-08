import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { canViewActivity, canViewProfile, isBlocked, isFollowing } from "./authorization";

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

let publicUser: string, privateUser: string, follower: string, stranger: string, blocker: string, blocked: string;

beforeAll(async () => {
  publicUser = await makeUser("public", true);
  privateUser = await makeUser("private", false);
  follower = await makeUser("follower", true);
  stranger = await makeUser("stranger", true);
  blocker = await makeUser("blocker", true);
  blocked = await makeUser("blocked", true);

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
