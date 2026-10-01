import "dotenv/config";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { SESSION_EXPIRED_ERROR } from "@/lib/auth/session-expired";
import { isAdminUser } from "@/lib/auth/roles";
import { canViewActivity, activityAccess } from "@/lib/social/authorization";

/**
 * Report moderation (decision 15, W-141 D) against the real local Postgres:
 * hide (for good, link revoked), delete (history kept), ban (sessions,
 * notifications and push subscriptions gone, content hidden), the sibling
 * reports resolved with the decision, unban, and who may moderate.
 */

const RUN_ID = `admin-${Date.now()}`;
let current: { id: string; email: string; role?: string | null } | null = null;
/** The session lookup itself fails (e.g. the database is down). */
let lookupFails = false;

vi.mock("@/lib/auth/require-user", () => ({
  requireUserOrThrow: async () => {
    if (!current) throw new Error("UNAUTHORIZED");
    return current;
  },
  requireAdminOrThrow: async () => {
    if (lookupFails) throw new Error("Can't reach database server");
    if (!current) throw new Error("UNAUTHORIZED");
    if (!isAdminUser(current)) throw new Error("FORBIDDEN");
    return current;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const admin = await import("./admin");
const { getPublicProfile } = await import("@/lib/data/social");

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

async function makeActivity(userId: string) {
  const updatedAt = new Date(Date.now() - 3_600_000);
  const session = await prisma.workoutSession.create({
    data: { userId, name: "Pernas", status: "COMPLETED", startedAt: updatedAt, finishedAt: updatedAt, visibility: "PUBLIC", updatedAt },
  });
  const activity = await prisma.activity.create({
    data: {
      userId,
      type: "WORKOUT",
      sessionId: session.id,
      visibility: "PUBLIC",
      summary: { workoutName: "Pernas" },
      shareToken: `tok${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.slice(0, 16).padEnd(16, "x"),
      sharedAt: new Date(),
    },
  });
  return { activityId: activity.id, sessionId: session.id, updatedAt };
}

async function report(reporterId: string, target: { activityId?: string; reportedUserId: string }) {
  return (
    await prisma.userReport.create({
      data: { reporterId, reportedUserId: target.reportedUserId, activityId: target.activityId ?? null, reason: "SPAM" },
    })
  ).id;
}

beforeEach(() => {
  current = null;
  lookupFails = false;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe("who may moderate", () => {
  it("refuses a non-admin and an expired session; an ADMIN_EMAILS-only account passes", async () => {
    const plain = await makeUser("comum");
    const author = await makeUser("autor1");
    const id = await report(plain.id, { reportedUserId: author.id });
    current = plain;
    expect(await admin.moderateReport(id, "REVIEW")).toEqual({ ok: false, error: "Você não tem acesso a isso." });
    current = null;
    expect(await admin.moderateReport(id, "REVIEW")).toEqual({ ok: false, error: SESSION_EXPIRED_ERROR });
    // A session check that fails (not an expired session) is a plain retry, not "entre de novo".
    lookupFails = true;
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await admin.moderateReport(id, "REVIEW")).toEqual({ ok: false, error: "Não foi possível concluir agora. Tente de novo." });
    expect(await admin.unbanUser(author.id)).toEqual({ ok: false, error: "Não foi possível concluir agora. Tente de novo." });
    errors.mockRestore();
    lookupFails = false;

    const saved = process.env.ADMIN_EMAILS;
    process.env.ADMIN_EMAILS = plain.email.toUpperCase();
    try {
      current = plain;
      expect(await admin.moderateReport(id, "DISMISS")).toMatchObject({ ok: true, status: "DISMISSED" });
      expect(await admin.moderateReport(id, "REVIEW")).toEqual({ ok: false, error: "Esta denúncia já foi resolvida." });
    } finally {
      process.env.ADMIN_EMAILS = saved;
    }
  });
});

describe("moderateReport", () => {
  it("hides a workout for good: both private, link revoked, the save time kept, sibling reports resolved", async () => {
    const mod = await makeUser("mod1", "admin");
    const author = await makeUser("autor2");
    const r1 = await makeUser("rep1");
    const r2 = await makeUser("rep2");
    const { activityId, sessionId, updatedAt } = await makeActivity(author.id);
    const a = await report(r1.id, { activityId, reportedUserId: author.id });
    const b = await report(r2.id, { activityId, reportedUserId: author.id });
    const token = (await prisma.activity.findUniqueOrThrow({ where: { id: activityId }, select: { shareToken: true } })).shareToken;

    current = mod;
    expect(await admin.moderateReport(a, "HIDE", "")).toEqual({ ok: true, status: "ACTIONED", resolved: 2 });
    const activity = await prisma.activity.findUniqueOrThrow({
      where: { id: activityId },
      select: { visibility: true, shareToken: true, sharedAt: true, moderatedAt: true, userId: true, id: true },
    });
    expect(activity).toMatchObject({ visibility: "PRIVATE", shareToken: null, sharedAt: null });
    expect(activity.moderatedAt).not.toBeNull();
    const session = await prisma.workoutSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(session.visibility).toBe("PRIVATE");
    expect(session.updatedAt).toEqual(updatedAt);
    expect(await activityAccess(r1.id, activity, token)).toBe("none");
    const reports = await prisma.userReport.findMany({ where: { id: { in: [a, b] } } });
    expect(reports.every((r) => r.status === "ACTIONED" && r.resolvedById === mod.id && r.resolvedAt)).toBe(true);
  });

  it("deletes a post: the workout stays, private; reports keep a note", async () => {
    const mod = await makeUser("mod2", "admin");
    const author = await makeUser("autor3");
    const rep = await makeUser("rep3");
    const { activityId, sessionId } = await makeActivity(author.id);
    const id = await report(rep.id, { activityId, reportedUserId: author.id });
    current = mod;
    expect(await admin.moderateReport(id, "DELETE", "spam repetido")).toEqual({ ok: true, status: "ACTIONED", resolved: 1 });
    expect(await prisma.activity.count({ where: { id: activityId } })).toBe(0);
    expect((await prisma.workoutSession.findUniqueOrThrow({ where: { id: sessionId } })).visibility).toBe("PRIVATE");
    const resolved = await prisma.userReport.findUniqueOrThrow({ where: { id } });
    expect(resolved.resolutionNote).toBe("Publicação excluída: Pernas — spam repetido");
    expect(resolved.activityId).toBeNull();
  });

  it("bans: sessions, sent notifications and push subscriptions go; the person disappears; every open report about them closes", async () => {
    const mod = await makeUser("mod3", "admin");
    const bad = await makeUser("banir");
    const rep = await makeUser("rep4");
    const victim = await makeUser("vitima");
    const { activityId } = await makeActivity(bad.id);
    const r1 = await report(rep.id, { reportedUserId: bad.id });
    const r2 = await report(victim.id, { activityId, reportedUserId: bad.id });
    await prisma.session.create({ data: { id: `${RUN_ID}-s`, token: `${RUN_ID}-t`, userId: bad.id, expiresAt: new Date(Date.now() + 86_400_000) } });
    await prisma.notification.create({ data: { recipientId: victim.id, actorId: bad.id, type: "NEW_FOLLOWER" } });
    await prisma.pushSubscription.create({ data: { userId: bad.id, endpoint: `https://push.example/${RUN_ID}`, p256dh: "k", auth: "a" } });

    current = mod;
    expect(await admin.moderateReport(r1, "BAN", "assédio")).toEqual({ ok: true, status: "ACTIONED", resolved: 2 });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: bad.id } });
    expect(user).toMatchObject({ banned: true, banReason: "assédio", banExpires: null });
    expect(await prisma.session.count({ where: { userId: bad.id } })).toBe(0);
    expect(await prisma.notification.count({ where: { actorId: bad.id } })).toBe(0);
    expect(await prisma.pushSubscription.count({ where: { userId: bad.id } })).toBe(0);
    expect(await canViewActivity(victim.id, { userId: bad.id, visibility: "PUBLIC" })).toBe(false);
    expect(await getPublicProfile(user.username!, victim.id)).toBeNull();
    expect((await prisma.userReport.findUniqueOrThrow({ where: { id: r2 } })).status).toBe("ACTIONED");

    // Unban brings the account back (sessions don't come back).
    expect(await admin.unbanUser(bad.id)).toEqual({ ok: true });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: bad.id } })).banned).toBe(false);
    expect(await canViewActivity(victim.id, { userId: bad.id, visibility: "PUBLIC" })).toBe(true);
  });

  it("never bans yourself or another admin", async () => {
    const mod = await makeUser("mod4", "admin");
    const other = await makeUser("mod5", "admin");
    const rep = await makeUser("rep5");
    current = mod;
    const self = await report(rep.id, { reportedUserId: mod.id });
    expect(await admin.moderateReport(self, "BAN")).toEqual({ ok: false, error: "Você não pode banir a si mesmo." });
    const peer = await report(rep.id, { reportedUserId: other.id });
    expect(await admin.moderateReport(peer, "BAN")).toEqual({ ok: false, error: "Não é possível banir outro admin." });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: other.id } })).banned).toBe(false);
    // A person report can't be "hidden".
    expect(await admin.moderateReport(peer, "HIDE")).toEqual({ ok: false, error: "Esta denúncia não é sobre um treino." });
    // Reviewing a person report closes the other open ones about that person (not their workouts').
    const again = await report(mod.id, { reportedUserId: other.id });
    expect(await admin.moderateReport(peer, "REVIEW")).toEqual({ ok: true, status: "REVIEWED", resolved: 2 });
    expect((await prisma.userReport.findUniqueOrThrow({ where: { id: again } })).status).toBe("REVIEWED");
  });

  it("a report with no live post settles only reports about the same thing: the person, or one deleted post", async () => {
    const mod = await makeUser("mod6", "admin");
    const author = await makeUser("autor5");
    const rep = await makeUser("rep6");
    const open = (data: { reportedUserId: string | null; reason: "SPAM" | "HARASSMENT" | "FAKE_DATA"; snapshot?: object }) =>
      prisma.userReport.create({ data: { reporterId: rep.id, activityId: null, ...data } }).then((r) => r.id);
    const status = async (id: string) => (await prisma.userReport.findUniqueOrThrow({ where: { id } })).status;
    const person = await open({ reportedUserId: author.id, reason: "HARASSMENT", snapshot: { kind: "user", user: { id: author.id } } });
    // Two reports about a post the owner deleted since (their snapshots keep it), and one about another deleted post.
    const goneA1 = await open({ reportedUserId: author.id, reason: "FAKE_DATA", snapshot: { kind: "activity", activityId: `${RUN_ID}-gone-a` } });
    const goneA2 = await open({ reportedUserId: author.id, reason: "SPAM", snapshot: { kind: "activity", activityId: `${RUN_ID}-gone-a` } });
    const goneB = await open({ reportedUserId: author.id, reason: "SPAM", snapshot: { kind: "activity", activityId: `${RUN_ID}-gone-b` } });
    // Old workout reports kept no person: once their post is gone, nothing links them to anyone.
    const orphan1 = await open({ reportedUserId: null, reason: "SPAM" });
    const orphan2 = await open({ reportedUserId: null, reason: "SPAM" });

    current = mod;
    expect(await admin.moderateReport(goneA1, "REVIEW")).toEqual({ ok: true, status: "REVIEWED", resolved: 2 });
    expect([await status(goneA2), await status(goneB), await status(person)]).toEqual(["REVIEWED", "OPEN", "OPEN"]);
    expect(await admin.moderateReport(person, "DISMISS")).toEqual({ ok: true, status: "DISMISSED", resolved: 1 });
    expect(await status(goneB)).toBe("OPEN");
    expect(await admin.moderateReport(orphan1, "DISMISS")).toEqual({ ok: true, status: "DISMISSED", resolved: 1 });
    expect(await status(orphan2)).toBe("OPEN");
    await prisma.userReport.deleteMany({ where: { id: { in: [goneB, orphan2] } } });
  });
});
