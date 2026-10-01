import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { getFeed, getFgGivers, getTeamStrip, hasEverGivenFg } from "./feed";

/**
 * The feed (W-142), Today's team strip (W-139) and the FG givers (W-143)
 * against the real local Postgres: growth pagination with a stable order,
 * banned authors left out, the strip's 7-day window and the givers the
 * viewer may see.
 */

const RUN = `feed-${Date.now()}`;
const NOW = new Date();
const HOUR = 60 * 60 * 1000;
const ids: string[] = [];

async function user(label: string, opts: { banned?: boolean } = {}) {
  const id = `${RUN}-${label}`;
  await prisma.user.create({
    data: { id, name: label, email: `${id}@fgpower.test`, emailVerified: true, username: `${RUN}_${label}`.replace(/-/g, "_"), banned: opts.banned ?? false },
  });
  await prisma.profile.create({ data: { userId: id, displayName: `Nome ${label}`, isPublicAccount: true } });
  ids.push(id);
  return id;
}

let n = 0;
async function activity(
  userId: string,
  opts: { at: Date; visibility?: "PRIVATE" | "FOLLOWERS" | "PUBLIC"; type?: "WORKOUT" | "MILESTONE"; name?: string },
) {
  n += 1;
  return prisma.activity.create({
    data: {
      id: `${RUN}-a${String(n).padStart(3, "0")}`,
      userId,
      type: opts.type ?? "WORKOUT",
      visibility: opts.visibility ?? "FOLLOWERS",
      createdAt: opts.at,
      summary: { workoutName: opts.name ?? `Treino ${n}`, durationSeconds: null, totalWorkingSets: 3, totalVolumeKg: 900, exercises: [], prs: [] },
    },
  });
}

let viewer: string, friend: string, banned: string, stranger: string, blocker: string;

beforeAll(async () => {
  viewer = await user("viewer");
  friend = await user("friend");
  banned = await user("banned", { banned: true });
  stranger = await user("stranger");
  blocker = await user("blocker");
  for (const id of [friend, banned, blocker]) await prisma.follow.create({ data: { followerId: viewer, followingId: id } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

describe("getFeed", () => {
  it("grows 15 at a time with hasMore, in a stable order even when createdAt ties", async () => {
    // 20 followers-only workouts by a friend, 10 of them at the very same instant, plus 12 of the viewer's own.
    const tie = new Date(NOW.getTime() - 3 * HOUR);
    for (let i = 0; i < 10; i++) await activity(friend, { at: tie });
    for (let i = 0; i < 10; i++) await activity(friend, { at: new Date(NOW.getTime() - (10 + i) * HOUR) });
    for (let i = 0; i < 12; i++) await activity(viewer, { at: new Date(NOW.getTime() - (40 + i) * HOUR), visibility: "PRIVATE" });

    const first = await getFeed(viewer, { limit: 15 });
    expect(first.items).toHaveLength(15);
    expect(first.hasMore).toBe(true);
    const all = await getFeed(viewer, { limit: 45 });
    expect(all.items).toHaveLength(32);
    expect(all.hasMore).toBe(false);
    // The first 15 are the same 15, in the same order, however often it's asked.
    expect(all.items.slice(0, 15).map((a) => a.id)).toEqual(first.items.map((a) => a.id));
    expect((await getFeed(viewer, { limit: 15 })).items.map((a) => a.id)).toEqual(first.items.map((a) => a.id));
    // Ties: newest id first.
    const tied = all.items.filter((a) => a.createdAt.getTime() === tie.getTime()).map((a) => a.id);
    expect(tied).toEqual([...tied].sort().reverse());
  });

  it("shows a followed author's FOLLOWERS/PUBLIC workouts, never their PRIVATE ones or a banned author's", async () => {
    const hidden = await activity(friend, { at: NOW, visibility: "PRIVATE" });
    const byBanned = await activity(banned, { at: NOW, visibility: "PUBLIC" });
    const byStranger = await activity(stranger, { at: NOW, visibility: "PUBLIC" });
    const got = new Set((await getFeed(viewer, { limit: 100 })).items.map((a) => a.id));
    expect(got.has(hidden.id)).toBe(false);
    expect(got.has(byBanned.id)).toBe(false);
    expect(got.has(byStranger.id)).toBe(false);
  });
});

describe("getTeamStrip", () => {
  it("is cold when the user follows nobody", async () => {
    expect(await getTeamStrip(stranger, NOW)).toEqual({ kind: "cold" });
  });

  it("lists up to 3 of the last 7 days' FOLLOWERS/PUBLIC workouts of followed people, newest first", async () => {
    const lonely = await user("lonely");
    const pal = await user("pal");
    await prisma.follow.create({ data: { followerId: lonely, followingId: pal } });
    expect(await getTeamStrip(lonely, NOW)).toEqual({ kind: "team", items: [] });

    await activity(pal, { at: new Date(NOW.getTime() - 8 * 24 * HOUR), name: "Velho" });
    await activity(pal, { at: new Date(NOW.getTime() - HOUR), visibility: "PRIVATE", name: "Privado" });
    await activity(pal, { at: new Date(NOW.getTime() - 2 * HOUR), type: "MILESTONE", name: "Carimbo" });
    const a = await activity(pal, { at: new Date(NOW.getTime() - 5 * HOUR), name: "Push A" });
    await activity(pal, { at: new Date(NOW.getTime() - 6 * HOUR), visibility: "PUBLIC", name: "Pull B" });
    await activity(pal, { at: new Date(NOW.getTime() - 7 * HOUR), name: "Legs" });
    await activity(pal, { at: new Date(NOW.getTime() - 8 * HOUR), name: "Quarto" });
    await prisma.activityFG.create({ data: { activityId: a.id, userId: lonely } });

    const strip = await getTeamStrip(lonely, NOW);
    expect(strip.kind).toBe("team");
    if (strip.kind !== "team") return;
    expect(strip.items.map((i) => i.workoutName)).toEqual(["Push A", "Pull B", "Legs"]);
    expect(strip.items[0]).toMatchObject({ hasGivenFg: true, user: { id: pal, name: "Nome pal" } });
    // Only the name of the stored summary crosses over.
    expect(Object.keys(strip.items[0]).sort()).toEqual(["createdAt", "fgCount", "hasGivenFg", "id", "user", "workoutName"]);
  });

  it("leaves out a banned author", async () => {
    const fan = await user("fan");
    await prisma.follow.create({ data: { followerId: fan, followingId: banned } });
    await activity(banned, { at: new Date(NOW.getTime() - HOUR) });
    expect(await getTeamStrip(fan, NOW)).toEqual({ kind: "team", items: [] });
  });
});

describe("getFgGivers / hasEverGivenFg", () => {
  it("names givers newest first, never a banned one or anyone blocked with the viewer", async () => {
    const post = await activity(friend, { at: NOW, visibility: "PUBLIC" });
    const early = await user("early");
    await prisma.activityFG.create({ data: { activityId: post.id, userId: early, createdAt: new Date(NOW.getTime() - 3000) } });
    await prisma.activityFG.create({ data: { activityId: post.id, userId: viewer, createdAt: new Date(NOW.getTime() - 2000) } });
    await prisma.activityFG.create({ data: { activityId: post.id, userId: banned, createdAt: new Date(NOW.getTime() - 1000) } });
    await prisma.activityFG.create({ data: { activityId: post.id, userId: blocker, createdAt: NOW } });
    await prisma.userBlock.create({ data: { blockerId: blocker, blockedId: stranger } });

    expect((await getFgGivers(post.id, viewer)).map((g) => g.id)).toEqual([blocker, viewer, early]);
    // The blocked pair: the stranger doesn't see the person who blocked them.
    expect((await getFgGivers(post.id, stranger)).map((g) => g.id)).toEqual([viewer, early]);
    expect((await getFgGivers(post.id, null)).map((g) => g.name)).toEqual(["Nome blocker", "Nome viewer", "Nome early"]);

    expect(await hasEverGivenFg(viewer)).toBe(true);
    expect(await hasEverGivenFg(stranger)).toBe(false);
  });
});
