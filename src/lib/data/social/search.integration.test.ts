import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { searchUsers } from "./search";
import { getProfileActivities, getPublicProfile } from "./profile";

/**
 * People search (W-145) and the public profile's loaders (W-140, W-142,
 * W-146, W-048 §6) against the real local Postgres.
 */

const RUN = `srch${Date.now().toString(36)}`;
const ids: string[] = [];

async function user(
  handle: string,
  opts: { name?: string; displayName?: string; banned?: boolean; discoverable?: boolean; isPublicAccount?: boolean; showCurrentProgram?: boolean; bio?: string } = {},
) {
  const id = `${RUN}-${handle}`;
  await prisma.user.create({
    data: {
      id,
      name: opts.name ?? handle,
      email: `${id}@fgpower.test`,
      emailVerified: true,
      username: `${RUN}${handle}`.toLowerCase(),
      banned: opts.banned ?? false,
    },
  });
  await prisma.profile.create({
    data: {
      userId: id,
      displayName: opts.displayName ?? `Nome ${handle}`,
      discoverable: opts.discoverable ?? true,
      isPublicAccount: opts.isPublicAccount ?? true,
      showCurrentProgram: opts.showCurrentProgram ?? true,
      bio: opts.bio,
    },
  });
  ids.push(id);
  return id;
}

let viewer: string;
let gd: { id: string; slug: string };

beforeAll(async () => {
  gd = await prisma.workoutTemplate.findFirstOrThrow({ where: { isPublished: true }, orderBy: { slug: "asc" }, select: { id: true, slug: true } });
  viewer = await user("viewer", { displayName: `Busca ${RUN}` });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

describe("searchUsers", () => {
  it("never returns the viewer, a banned or hidden account, or anyone blocked either way", async () => {
    const shown = await user("ana", { displayName: `Busca ${RUN} Ana` });
    const banned = await user("bia", { displayName: `Busca ${RUN} Bia`, banned: true });
    const hidden = await user("cris", { displayName: `Busca ${RUN} Cris`, discoverable: false });
    const blocker = await user("duda", { displayName: `Busca ${RUN} Duda` });
    const blocked = await user("eva", { displayName: `Busca ${RUN} Eva` });
    await prisma.userBlock.create({ data: { blockerId: blocker, blockedId: viewer } });
    await prisma.userBlock.create({ data: { blockerId: viewer, blockedId: blocked } });

    const got = (await searchUsers(`Busca ${RUN}`, viewer)).map((p) => p.id);
    expect(got).toContain(shown);
    for (const id of [viewer, banned, hidden, blocker, blocked]) expect(got).not.toContain(id);
  });

  it("carries the follow state, bio and shown program for each row", async () => {
    const followed = await user("fabi", { displayName: `Rel ${RUN} Fabi`, bio: "x".repeat(200) });
    const asked = await user("gil", { displayName: `Rel ${RUN} Gil`, isPublicAccount: false });
    const none = await user("hana", { displayName: `Rel ${RUN} Hana`, showCurrentProgram: false });
    await prisma.follow.create({ data: { followerId: viewer, followingId: followed } });
    await prisma.follow.create({ data: { followerId: none, followingId: viewer } });
    await prisma.followRequest.create({ data: { requesterId: viewer, targetId: asked } });
    for (const id of [followed, none]) {
      await prisma.userProgram.create({ data: { userId: id, name: "GD 1", status: "ACTIVE", sourceTemplateId: gd.id } });
    }

    const rows = new Map((await searchUsers(`rel ${RUN}`, viewer)).map((p) => [p.id, p]));
    expect(rows.get(followed)).toMatchObject({ relation: "FOLLOWING", programName: "GD 1", followsYou: false });
    expect(rows.get(followed)!.bio!.length).toBeLessThanOrEqual(90);
    expect(rows.get(asked)).toMatchObject({ relation: "REQUESTED", isPublicAccount: false, programName: null });
    // Hana hides her program; she follows the viewer.
    expect(rows.get(none)).toMatchObject({ relation: "NONE", programName: null, followsYou: true });
  });

  it("ranks the exact @handle first, then handles starting with the query, then the rest", async () => {
    const exact = await user("zed");
    const prefix = await user("zedinho");
    const inName = await user("xyz", { displayName: `Amigo do ${RUN}zed` });
    const got = (await searchUsers(`@${RUN}ZED`, viewer)).map((p) => p.id);
    expect(got.slice(0, 3)).toEqual([exact, prefix, inName]);
  });

  it("reads % and _ literally, not as wildcards", async () => {
    expect(await searchUsers(`${RUN}%`, viewer)).toEqual([]);
    expect(await searchUsers(`${RUN}_`, viewer)).toEqual([]);
  });

  it("finds by display name but not by the account name behind it", async () => {
    const carla = await user("carla", { name: `Carla Mendes ${RUN}`, displayName: `Carlinha ${RUN}` });
    expect((await searchUsers(`Carlinha ${RUN}`, viewer)).map((p) => p.id)).toEqual([carla]);
    expect(await searchUsers(`Carla Mendes ${RUN}`, viewer)).toEqual([]);
  });
});

describe("getPublicProfile", () => {
  it("links a published template's program and knows when the viewer runs the same one", async () => {
    const owner = await user("dono", { isPublicAccount: false });
    await prisma.userProgram.create({ data: { userId: owner, name: "GD 1", status: "ACTIVE", sourceTemplateId: gd.id } });
    await prisma.follow.create({ data: { followerId: owner, followingId: viewer } });
    const handle = `${RUN}dono`.toLowerCase();

    const asViewer = await getPublicProfile(handle, viewer);
    expect(asViewer).toMatchObject({
      activeProgramName: "GD 1",
      activeProgramTemplateSlug: gd.slug,
      sameProgramAsViewer: false,
      followsViewer: true,
      canViewActivity: false,
      defaultWorkoutVisibility: null,
    });
    await prisma.userProgram.create({ data: { userId: viewer, name: "Meu GD", status: "ACTIVE", sourceTemplateId: gd.id } });
    expect((await getPublicProfile(handle, viewer))!.sameProgramAsViewer).toBe(true);
    // Anonymous: no relation to the viewer, the owner's default stays private.
    expect(await getPublicProfile(handle, null)).toMatchObject({ followsViewer: false, sameProgramAsViewer: false, defaultWorkoutVisibility: null });
    // The owner sees how their workouts are published (the empty state explains it).
    expect((await getPublicProfile(handle, owner))!.defaultWorkoutVisibility).toBe("FOLLOWERS");
  });

  it("keeps a custom program a plain name, and hides a program its owner doesn't show", async () => {
    const custom = await user("custom");
    await prisma.userProgram.create({ data: { userId: custom, name: "Meu treino", status: "ACTIVE" } });
    expect(await getPublicProfile(`${RUN}custom`, viewer)).toMatchObject({ activeProgramName: "Meu treino", activeProgramTemplateSlug: null });
    const shy = await user("shy", { showCurrentProgram: false });
    await prisma.userProgram.create({ data: { userId: shy, name: "GD 1", status: "ACTIVE", sourceTemplateId: gd.id } });
    expect(await getPublicProfile(`${RUN}shy`, viewer)).toMatchObject({ activeProgramName: null, activeProgramTemplateSlug: null });
    expect((await getPublicProfile(`${RUN}shy`, shy))!.activeProgramName).toBe("GD 1");
  });

  it("counts followers and following without banned accounts, as the owner's lists do", async () => {
    const star = await user("star");
    const fan = await user("fan");
    const bannedFan = await user("bfan", { banned: true });
    const idol = await user("idol");
    const bannedIdol = await user("bidol", { banned: true });
    await prisma.follow.createMany({
      data: [
        { followerId: fan, followingId: star },
        { followerId: bannedFan, followingId: star },
        { followerId: star, followingId: idol },
        { followerId: star, followingId: bannedIdol },
      ],
    });
    for (const viewerId of [viewer, star, null]) {
      expect(await getPublicProfile(`${RUN}star`, viewerId)).toMatchObject({ followerCount: 1, followingCount: 1 });
    }
  });

  it("is null for a banned account (except to its owner) and for a blocked pair", async () => {
    const gone = await user("gone", { banned: true });
    expect(await getPublicProfile(`${RUN}gone`, viewer)).toBeNull();
    expect(await getPublicProfile(`${RUN}gone`, gone)).not.toBeNull();
    const wall = await user("wall");
    await prisma.userBlock.create({ data: { blockerId: wall, blockedId: viewer } });
    expect(await getPublicProfile(`${RUN}wall`, viewer)).toBeNull();
  });
});

describe("getProfileActivities", () => {
  it("pages 20 at a time with hasMore, newest first and ties by id", async () => {
    const busy = await user("busy");
    const at = new Date();
    for (let i = 0; i < 23; i++) {
      await prisma.activity.create({
        data: {
          id: `${RUN}-p${String(i).padStart(2, "0")}`,
          userId: busy,
          type: "WORKOUT",
          visibility: "PUBLIC",
          createdAt: i < 5 ? at : new Date(at.getTime() - i * 60_000),
          summary: { workoutName: `T${i}`, totalWorkingSets: 1, prs: [], exercises: [] },
        },
      });
    }
    const first = await getProfileActivities(busy, viewer, true);
    expect(first.items).toHaveLength(20);
    expect(first.hasMore).toBe(true);
    const all = await getProfileActivities(busy, viewer, true, { limit: 40 });
    expect(all.items).toHaveLength(23);
    expect(all.hasMore).toBe(false);
    expect(all.items.slice(0, 5).map((a) => a.id)).toEqual([4, 3, 2, 1, 0].map((i) => `${RUN}-p0${i}`));
    expect(await getProfileActivities(busy, viewer, false)).toEqual({ items: [], hasMore: false });
  });
});
