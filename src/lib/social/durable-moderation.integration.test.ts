import "dotenv/config";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { isAdminUser } from "@/lib/auth/roles";

/**
 * Durable moderation (A-012) against the real local Postgres: an admin's HIDE
 * or DELETE stamps the marker on the WorkoutSession itself (not only on the
 * disposable Activity row), so a DELETE that removes the Activity still blocks
 * the owner from re-publishing or re-sharing the workout. The single publish
 * chokepoint upsertWorkoutActivity refuses a moderated session, which closes
 * both shareWorkoutSession and the share-link path (ensureWorkoutShareLink →
 * mintShareToken). DELETE also clears the reported caption.
 */

const RUN_ID = `dmod-${Date.now()}`;
let current: { id: string; email: string; role?: string | null } | null = null;

vi.mock("@/lib/auth/require-user", () => ({
  requireUserOrThrow: async () => {
    if (!current) throw new Error("UNAUTHORIZED");
    return current;
  },
  requireAdminOrThrow: async () => {
    if (!current) throw new Error("UNAUTHORIZED");
    if (!isAdminUser(current)) throw new Error("FORBIDDEN");
    return current;
  },
  getCurrentSession: async () => (current ? { user: current } : null),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const admin = await import("@/lib/actions/admin");
const activities = await import("@/lib/actions/activities");
const { upsertWorkoutActivity, PublishError } = await import("./publish");

const MODERATED = "Esta publicação foi ocultada pela moderação.";
const userIds: string[] = [];

async function makeUser(label: string, role = "user") {
  const id = `${RUN_ID}-${label}`;
  await prisma.user.create({
    data: { id, name: label, email: `${id}@fgpower.test`, emailVerified: true, role, username: `${label}_${Date.now().toString(36)}`.slice(0, 30) },
  });
  await prisma.profile.create({ data: { userId: id, displayName: label, onboardingCompletedAt: new Date(), isPublicAccount: true } });
  userIds.push(id);
  return { id, email: `${id}@fgpower.test`, role };
}

/** A finished workout + its PUBLIC post, both carrying a reported caption + a share token. */
async function makeActivity(userId: string) {
  const at = new Date(Date.now() - 3_600_000);
  const session = await prisma.workoutSession.create({
    data: { userId, name: "Pernas", status: "COMPLETED", startedAt: at, finishedAt: at, visibility: "PUBLIC", caption: "olha meu spam", updatedAt: at },
  });
  const activity = await prisma.activity.create({
    data: {
      userId,
      type: "WORKOUT",
      sessionId: session.id,
      visibility: "PUBLIC",
      caption: "olha meu spam",
      summary: { workoutName: "Pernas" },
      shareToken: `tok${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.slice(0, 16).padEnd(16, "x"),
      sharedAt: new Date(),
    },
  });
  return { activityId: activity.id, sessionId: session.id };
}

async function report(reporterId: string, activityId: string, reportedUserId: string) {
  return (await prisma.userReport.create({ data: { reporterId, reportedUserId, activityId, reason: "SPAM" } })).id;
}

beforeEach(() => {
  current = null;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe("DELETE is durable: the Activity goes but the owner can't bring it back", () => {
  it("stamps the session, clears the caption, and refuses re-publish and re-share", async () => {
    const mod = await makeUser("moddel", "admin");
    const author = await makeUser("autordel");
    const rep = await makeUser("repdel");
    const { activityId, sessionId } = await makeActivity(author.id);
    const reportId = await report(rep.id, activityId, author.id);

    current = mod;
    expect(await admin.moderateReport(reportId, "DELETE", "spam")).toMatchObject({ ok: true, status: "ACTIONED" });

    // The post is gone; the durable marker is on the retained workout; the reported caption is wiped.
    expect(await prisma.activity.count({ where: { id: activityId } })).toBe(0);
    const session = await prisma.workoutSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(session.moderatedAt).toBeInstanceOf(Date);
    expect(session.visibility).toBe("PRIVATE");
    expect(session.caption).toBeNull();

    // The author cannot resurrect it through the publish chokepoint...
    current = author;
    await expect(
      upsertWorkoutActivity({ userId: author.id, sessionId, visibility: "PUBLIC", showDetailedLoads: false }),
    ).rejects.toMatchObject({ code: "MODERATED" });
    await expect(
      upsertWorkoutActivity({ userId: author.id, sessionId, visibility: "PUBLIC", showDetailedLoads: false }),
    ).rejects.toBeInstanceOf(PublishError);

    // ...nor through the share-link path, and no new Activity / token is minted.
    expect(await activities.ensureWorkoutShareLink({ sessionId, showDetailedLoads: false })).toEqual({ ok: false, error: MODERATED });
    expect(await activities.shareWorkoutSession({ sessionId, visibility: "PUBLIC", showDetailedLoads: false })).toEqual({ ok: false, error: MODERATED });
    expect(await prisma.activity.count({ where: { sessionId } })).toBe(0);
  });
});

describe("HIDE is durable too: the retained post keeps the marker, the caption stays", () => {
  it("stamps both the Activity and the session; re-publish is refused; the caption is kept", async () => {
    const mod = await makeUser("modhide", "admin");
    const author = await makeUser("autorhide");
    const rep = await makeUser("rephide");
    const { activityId, sessionId } = await makeActivity(author.id);
    const reportId = await report(rep.id, activityId, author.id);

    current = mod;
    expect(await admin.moderateReport(reportId, "HIDE")).toMatchObject({ ok: true, status: "ACTIONED" });

    // The post is kept (history), private and marked; the link is revoked.
    // shareToken is omitted from ordinary reads (lib/db.ts), so select it explicitly.
    const activity = await prisma.activity.findUniqueOrThrow({
      where: { id: activityId },
      select: { visibility: true, shareToken: true, sharedAt: true, moderatedAt: true },
    });
    expect(activity).toMatchObject({ visibility: "PRIVATE", shareToken: null, sharedAt: null });
    expect(activity.moderatedAt).toBeInstanceOf(Date);
    // The workout carries its own durable marker; HIDE keeps the caption (only DELETE wipes it).
    const session = await prisma.workoutSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(session.moderatedAt).toBeInstanceOf(Date);
    expect(session.caption).toBe("olha meu spam");

    // Re-publishing the hidden post is refused at the chokepoint.
    current = author;
    await expect(
      upsertWorkoutActivity({ userId: author.id, sessionId, visibility: "PUBLIC", showDetailedLoads: false }),
    ).rejects.toMatchObject({ code: "MODERATED" });
    expect(await activities.ensureWorkoutShareLink({ sessionId, showDetailedLoads: false })).toEqual({ ok: false, error: MODERATED });
  });
});
