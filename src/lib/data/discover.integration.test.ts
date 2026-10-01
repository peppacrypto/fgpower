import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { activeThisWeek, communityActivities, sameProgramPeople } from "./discover";

/**
 * Descobrir's suggestions and the empty feed's community strip (W-047),
 * against the real local Postgres: only people who chose to be found, never
 * the viewer or anyone already followed, asked or blocked; only PUBLIC
 * workouts of PUBLIC accounts are ever put in front of strangers.
 */

const RUN = `disc-${Date.now()}`;
// A "now" decades ahead: the time-window queries then see only this test's
// workouts, whatever else the shared local DB holds (other test runs).
const NOW = new Date(Date.UTC(2091, 2, 10, 15, 0, 0));
const HOUR = 60 * 60 * 1000;
const ids: string[] = [];
let templateId: string;
let otherTemplateId: string;

async function user(
  label: string,
  opts: {
    discoverable?: boolean;
    isPublicAccount?: boolean;
    showCurrentProgram?: boolean;
    username?: string | null;
    banned?: boolean;
    program?: string | null;
  } = {},
) {
  const id = `${RUN}-${label}`;
  await prisma.user.create({
    data: {
      id,
      name: label,
      email: `${id}@fgpower.test`,
      emailVerified: true,
      username: opts.username === null ? null : (opts.username ?? `${RUN}_${label}`.toLowerCase().replace(/-/g, "_")),
      banned: opts.banned ?? false,
    },
  });
  await prisma.profile.create({
    data: {
      userId: id,
      displayName: `Nome ${label}`,
      discoverable: opts.discoverable ?? true,
      isPublicAccount: opts.isPublicAccount ?? true,
      showCurrentProgram: opts.showCurrentProgram ?? true,
    },
  });
  if (opts.program !== null) {
    await prisma.userProgram.create({
      data: { userId: id, name: "GD 1", status: "ACTIVE", sourceTemplateId: opts.program ?? templateId },
    });
  }
  ids.push(id);
  return id;
}

async function workout(userId: string, opts: { at: Date; visibility?: "PRIVATE" | "FOLLOWERS" | "PUBLIC"; name?: string }) {
  const session = await prisma.workoutSession.create({
    data: { userId, name: opts.name ?? "Push A", status: "COMPLETED", startedAt: opts.at, finishedAt: opts.at },
  });
  return prisma.activity.create({
    data: {
      userId,
      type: "WORKOUT",
      sessionId: session.id,
      visibility: opts.visibility ?? "PUBLIC",
      createdAt: opts.at,
      summary: { workoutName: opts.name ?? "Push A", durationSeconds: 3000, totalWorkingSets: 12, totalVolumeKg: null, exercises: [], prs: [] },
    },
  });
}

let viewer: string;
const people: Record<string, string> = {};

beforeAll(async () => {
  // The two templates fewest people run, so other test users rarely compete for the 30 candidates.
  const templates = await prisma.workoutTemplate.findMany({
    select: { id: true, _count: { select: { forks: { where: { status: "ACTIVE" } } } } },
  });
  if (templates.length < 2) throw new Error("the seeded templates are missing");
  templates.sort((a, b) => a._count.forks - b._count.forks);
  [templateId, otherTemplateId] = [templates[0].id, templates[1].id];

  viewer = await user("viewer");
  people.recent = await user("recent");
  people.older = await user("older");
  people.never = await user("never"); // same program, no workout yet
  people.hidden = await user("hidden", { discoverable: false });
  people.noHandle = await user("nohandle", { username: null });
  people.banned = await user("banned", { banned: true });
  people.followed = await user("followed");
  people.asked = await user("asked");
  people.blocker = await user("blocker");
  people.blocked = await user("blocked");
  people.hidesProgram = await user("hidesprogram", { showCurrentProgram: false });
  people.otherProgram = await user("otherprogram", { program: otherTemplateId });
  people.privateAccount = await user("private", { isPublicAccount: false });

  await prisma.follow.create({ data: { followerId: viewer, followingId: people.followed } });
  await prisma.followRequest.create({ data: { requesterId: viewer, targetId: people.asked } });
  await prisma.userBlock.create({ data: { blockerId: people.blocker, blockedId: viewer } });
  await prisma.userBlock.create({ data: { blockerId: viewer, blockedId: people.blocked } });

  await workout(people.older, { at: new Date(NOW.getTime() - 5 * 24 * HOUR), name: "Pull B" });
  await workout(people.recent, { at: new Date(NOW.getTime() - 2 * HOUR), name: "Push A" });
  // Not advertised: a followers-only workout, a private one, and a PUBLIC one of a private account.
  await workout(people.otherProgram, { at: new Date(NOW.getTime() - HOUR), visibility: "FOLLOWERS" });
  await workout(people.hidesProgram, { at: new Date(NOW.getTime() - HOUR), visibility: "PRIVATE" });
  await workout(people.privateAccount, { at: new Date(NOW.getTime() - HOUR), visibility: "PUBLIC" });
  // Everyone excluded trains publicly too, so only the filters keep them out.
  for (const key of ["hidden", "noHandle", "banned", "followed", "asked", "blocker", "blocked"]) {
    await workout(people[key], { at: new Date(NOW.getTime() - 3 * HOUR) });
  }
  // Too old for "this week", recent enough for the community strip (14 days).
  await workout(people.hidesProgram, { at: new Date(NOW.getTime() - 10 * 24 * HOUR) });
  // The viewer's own public workout is never suggested back to them.
  await workout(viewer, { at: new Date(NOW.getTime() - HOUR) });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

describe("sameProgramPeople", () => {
  it("lists people on the same template who show it, most recently trained first", async () => {
    const rows = await sameProgramPeople(viewer, 30);
    const mine = rows.map((r) => r.person.id).filter((id) => ids.includes(id));
    // A private account is still a person to follow (by request); only its workouts stay unadvertised.
    expect(mine).toEqual([people.privateAccount, people.recent, people.older, people.never]);
    const recent = rows.find((r) => r.person.id === people.recent)!;
    expect(recent.meta).toBe("Treinando: GD 1");
    expect(recent.person).toMatchObject({ relation: "NONE", username: expect.any(String), isPublicAccount: true });
    expect(rows.find((r) => r.person.id === people.privateAccount)!.person.isPublicAccount).toBe(false);
  });

  it("leaves out the viewer, followed, asked, blocked (both ways), banned, hidden, handle-less and program-hiding people", async () => {
    const got = new Set((await sameProgramPeople(viewer, 30)).map((r) => r.person.id));
    for (const key of ["hidden", "noHandle", "banned", "followed", "asked", "blocker", "blocked", "hidesProgram", "otherProgram"]) {
      expect(got.has(people[key]), key).toBe(false);
    }
    expect(got.has(viewer)).toBe(false);
  });

  it("is empty without a template program", async () => {
    const loner = await user("loner", { program: null });
    expect(await sameProgramPeople(loner)).toEqual([]);
  });
});

describe("activeThisWeek", () => {
  it("shows PUBLIC workouts of public, discoverable accounts from 7 days, one per person, newest first", async () => {
    const rows = (await activeThisWeek(viewer, { limit: 40, now: NOW })).filter((r) => ids.includes(r.person.id));
    expect(rows.map((r) => r.person.id)).toEqual([people.recent, people.older]);
    expect(rows[0].meta).toBe("Treinou hoje · Push A");
    expect(rows[1].meta).toBe("Treinou há 5 dias · Pull B");
  });

  it("never advertises FOLLOWERS or PRIVATE workouts, or a private account's PUBLIC one", async () => {
    const got = new Set((await activeThisWeek(viewer, { limit: 40, now: NOW })).map((r) => r.person.id));
    for (const key of ["otherProgram", "hidesProgram", "privateAccount", "hidden", "banned", "followed", "asked", "blocker", "blocked"]) {
      expect(got.has(people[key]), key).toBe(false);
    }
    expect(got.has(viewer)).toBe(false);
  });

  it("skips people already suggested above", async () => {
    const rows = await activeThisWeek(viewer, { limit: 40, now: NOW, skip: [people.recent] });
    expect(rows.some((r) => r.person.id === people.recent)).toBe(false);
    expect(rows.some((r) => r.person.id === people.older)).toBe(true);
  });
});

describe("communityActivities", () => {
  it("gives full rows of 14 days of PUBLIC workouts of public accounts, one per author, with the viewer's FG", async () => {
    const recent = await prisma.activity.findFirstOrThrow({ where: { userId: people.recent } });
    await prisma.activityFG.create({ data: { activityId: recent.id, userId: viewer } });
    const rows = (await communityActivities(viewer, { limit: 40, now: NOW })).filter((a) => ids.includes(a.userId));
    // hidesProgram's only PUBLIC workout is the 10-day-old one.
    expect(rows.map((a) => a.userId)).toEqual([people.recent, people.older, people.hidesProgram]);
    expect(rows[0]).toMatchObject({ hasGivenFg: true, user: { name: "Nome recent" } });
    for (const id of [viewer, people.privateAccount, people.banned, people.followed, people.asked, people.blocker, people.blocked]) {
      expect(rows.some((a) => a.userId === id)).toBe(false);
    }
  });
});
