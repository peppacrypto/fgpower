import "dotenv/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { SESSION_EXPIRED_ERROR } from "@/lib/auth/session-expired";

/**
 * The social actions against the real local Postgres (W-042, W-044, W-137,
 * W-138, W-141): honest follow requests, one notification per event, FG
 * races, blocking, removing a follower, reports (visibility, dedupe, limit,
 * snapshot, admin e-mail) and "seen".
 */

const RUN_ID = `social-${Date.now()}`;
let current: { id: string; email: string; role?: string | null } | null = null;
const deferred: Promise<unknown>[] = [];

vi.mock("@/lib/auth/require-user", () => ({
  requireUserOrThrow: async () => {
    if (!current) throw new Error("UNAUTHORIZED");
    return current;
  },
  getCurrentSession: async () => (current ? { user: current } : null),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => unknown) => {
    deferred.push(Promise.resolve().then(task));
  },
}));

const social = await import("./social");
const { getNotifications, getFollowers, getBlockedUsers } = await import("@/lib/data/social");

const userIds: string[] = [];
async function makeUser(label: string, opts: { isPublic?: boolean; profile?: boolean } = {}) {
  const id = `${RUN_ID}-${label}`;
  await prisma.user.create({
    data: { id, name: `Nome ${label}`, email: `${id}@fgpower.test`, emailVerified: true, username: `${label}_${Date.now().toString(36)}`.slice(0, 30) },
  });
  if (opts.profile !== false) {
    await prisma.profile.create({
      data: { userId: id, displayName: label[0].toUpperCase() + label.slice(1), onboardingCompletedAt: new Date(), isPublicAccount: opts.isPublic ?? false },
    });
  }
  userIds.push(id);
  return id;
}
const as = (id: string | null) => {
  current = id ? { id, email: `${id}@fgpower.test` } : null;
};

/** A finished workout with its activity. */
async function makeActivity(userId: string, visibility: "PRIVATE" | "FOLLOWERS" | "PUBLIC", name = "Push A") {
  const session = await prisma.workoutSession.create({
    data: { userId, name, status: "COMPLETED", startedAt: new Date(Date.now() - 3_600_000), finishedAt: new Date(), visibility },
  });
  const activity = await prisma.activity.create({
    data: { userId, type: "WORKOUT", sessionId: session.id, visibility, caption: "Hoje foi pesado", summary: { workoutName: name } },
  });
  return activity.id;
}

const notes = (recipientId: string, type?: string) =>
  prisma.notification.findMany({ where: { recipientId, ...(type ? { type: type as never } : {}) }, orderBy: { createdAt: "asc" } });

beforeEach(() => {
  current = null;
});

afterAll(async () => {
  await Promise.allSettled(deferred);
  await prisma.emailMessage.deleteMany({ where: { toEmail: { contains: RUN_ID } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe("followUser (W-044)", () => {
  let owner: string, fan: string;
  beforeAll(async () => {
    owner = await makeUser("privada");
    fan = await makeUser("fa");
  });

  it("asks a private account, and asking twice changes nothing", async () => {
    as(fan);
    expect(await social.followUser(owner)).toEqual({ ok: true, status: "REQUESTED" });
    const [first] = await notes(owner, "FOLLOW_REQUEST");
    expect(await social.followUser(owner)).toEqual({ ok: true, status: "REQUESTED" });
    const rows = await notes(owner, "FOLLOW_REQUEST");
    expect(rows).toHaveLength(1);
    expect(rows[0].createdAt).toEqual(first.createdAt);
  });

  it("asks again after an accepted follow was undone", async () => {
    const request = await prisma.followRequest.findUniqueOrThrow({ where: { requesterId_targetId: { requesterId: fan, targetId: owner } } });
    as(owner);
    expect(await social.respondToFollowRequest(request.id, true)).toEqual({ ok: true, status: "ACCEPTED" });
    as(fan);
    expect(await social.followUser(owner)).toEqual({ ok: true, status: "FOLLOWING" });
    expect(await social.unfollowUser(owner)).toEqual({ ok: true, status: "NONE" });
    expect(await prisma.followRequest.count({ where: { requesterId: fan, targetId: owner } })).toBe(0);

    expect(await social.followUser(owner)).toEqual({ ok: true, status: "REQUESTED" });
    const pending = await prisma.followRequest.findUniqueOrThrow({ where: { requesterId_targetId: { requesterId: fan, targetId: owner } } });
    expect(pending.status).toBe("PENDING");
    const rows = await notes(owner, "FOLLOW_REQUEST");
    expect(rows).toHaveLength(1);
    expect(rows[0].readAt).toBeNull();
  });

  it("re-arms a declined request as new (one row, unread, on top)", async () => {
    const request = await prisma.followRequest.findUniqueOrThrow({ where: { requesterId_targetId: { requesterId: fan, targetId: owner } } });
    as(owner);
    expect(await social.respondToFollowRequest(request.id, false)).toEqual({ ok: true, status: "DECLINED" });
    await prisma.notification.updateMany({ where: { recipientId: owner }, data: { readAt: new Date() } });
    const before = (await notes(owner, "FOLLOW_REQUEST"))[0];

    as(fan);
    expect(await social.followUser(owner)).toEqual({ ok: true, status: "REQUESTED" });
    const rows = await notes(owner, "FOLLOW_REQUEST");
    expect(rows).toHaveLength(1);
    expect(rows[0].readAt).toBeNull();
    expect(rows[0].createdAt.getTime()).toBeGreaterThan(before.createdAt.getTime());
    expect((await prisma.followRequest.findUniqueOrThrow({ where: { id: request.id } })).status).toBe("PENDING");
    // Answered twice (another device): the second answer reports what stands.
    as(owner);
    expect(await social.respondToFollowRequest(request.id, true)).toEqual({ ok: true, status: "ACCEPTED" });
    expect(await social.respondToFollowRequest(request.id, false)).toEqual({ ok: true, status: "ACCEPTED" });
    expect(await prisma.follow.count({ where: { followerId: fan, followingId: owner } })).toBe(1);
  });

  it("follows a public account once: follow / unfollow / follow keeps one row, and an unseen one is taken back", async () => {
    const star = await makeUser("publica", { isPublic: true });
    as(fan);
    expect(await social.followUser(star)).toEqual({ ok: true, status: "FOLLOWING" });
    expect(await notes(star, "NEW_FOLLOWER")).toHaveLength(1);
    expect(await social.unfollowUser(star)).toEqual({ ok: true, status: "NONE" });
    expect(await notes(star, "NEW_FOLLOWER")).toHaveLength(0);
    expect(await social.followUser(star)).toEqual({ ok: true, status: "FOLLOWING" });
    await prisma.notification.updateMany({ where: { recipientId: star }, data: { readAt: new Date() } });
    expect(await social.unfollowUser(star)).toEqual({ ok: true, status: "NONE" });
    expect(await social.followUser(star)).toEqual({ ok: true, status: "FOLLOWING" });
    const rows = await notes(star, "NEW_FOLLOWER");
    expect(rows).toHaveLength(1);
    // Read recently: a re-follow doesn't light the pip again.
    expect(rows[0].readAt).not.toBeNull();
    // Already following: nothing more happens.
    expect(await social.followUser(star)).toEqual({ ok: true, status: "FOLLOWING" });
    expect(await notes(star, "NEW_FOLLOWER")).toHaveLength(1);
  });

  it("answers a concurrent double tap with the real state", async () => {
    const other = await makeUser("dupla", { isPublic: true });
    as(fan);
    const results = await Promise.all([social.followUser(other), social.followUser(other)]);
    expect(results).toEqual([
      { ok: true, status: "FOLLOWING" },
      { ok: true, status: "FOLLOWING" },
    ]);
    expect(await prisma.follow.count({ where: { followerId: fan, followingId: other } })).toBe(1);
    expect(await notes(other, "NEW_FOLLOWER")).toHaveLength(1);
  });

  it("refuses yourself, blocked pairs, banned and unknown accounts; an expired session says so", async () => {
    const banned = await makeUser("banida", { isPublic: true });
    await prisma.user.update({ where: { id: banned }, data: { banned: true } });
    const noProfile = await makeUser("semperfil", { profile: false });
    as(fan);
    expect(await social.followUser(fan)).toEqual({ ok: false, error: "Você não pode seguir a si mesmo." });
    expect(await social.followUser(banned)).toEqual({ ok: false, error: "Esta conta não existe mais." });
    expect(await social.followUser(noProfile)).toEqual({ ok: false, error: "Esta conta não existe mais." });
    expect(await social.followUser("nope")).toEqual({ ok: false, error: "Esta conta não existe mais." });
    as(null);
    expect(await social.followUser(owner)).toEqual({ ok: false, error: SESSION_EXPIRED_ERROR });
    expect(await social.markNotificationsSeen(new Date().toISOString())).toEqual({ ok: false, error: SESSION_EXPIRED_ERROR });
  });
});

describe("FG (W-137)", () => {
  let author: string, fan: string, activityId: string;
  beforeAll(async () => {
    author = await makeUser("autora", { isPublic: true });
    fan = await makeUser("torcedor");
    activityId = await makeActivity(author, "PUBLIC");
  });

  it("gives, takes back and gives again: one row; an unseen FG taken back leaves no trace", async () => {
    as(fan);
    expect(await social.giveFg(activityId)).toEqual({ ok: true, fgCount: 1 });
    expect(await notes(author, "FG_RECEIVED")).toHaveLength(1);
    expect(await social.removeFg(activityId)).toEqual({ ok: true, fgCount: 0 });
    expect(await notes(author, "FG_RECEIVED")).toHaveLength(0);
    expect(await social.giveFg(activityId)).toEqual({ ok: true, fgCount: 1 });
    expect(await notes(author, "FG_RECEIVED")).toHaveLength(1);
  });

  it("keeps a read FG as history, and giving again doesn't notify again", async () => {
    await prisma.notification.updateMany({ where: { recipientId: author }, data: { readAt: new Date() } });
    as(fan);
    expect(await social.removeFg(activityId)).toEqual({ ok: true, fgCount: 0 });
    expect(await social.giveFg(activityId)).toEqual({ ok: true, fgCount: 1 });
    const rows = await notes(author, "FG_RECEIVED");
    expect(rows).toHaveLength(1);
    expect(rows[0].readAt).not.toBeNull();
  });

  it("counts a double tap once, and a second remove is not an error", async () => {
    as(fan);
    await social.removeFg(activityId);
    const given = await Promise.all([social.giveFg(activityId), social.giveFg(activityId)]);
    expect(given.every((r) => r.ok)).toBe(true);
    expect((await prisma.activity.findUniqueOrThrow({ where: { id: activityId } })).fgCount).toBe(1);
    expect(await prisma.activityFG.count({ where: { activityId } })).toBe(1);
    const removed = await Promise.all([social.removeFg(activityId), social.removeFg(activityId)]);
    expect(removed).toEqual([
      { ok: true, fgCount: 0 },
      { ok: true, fgCount: 0 },
    ]);
  });

  it("refuses your own workout and one you can't see", async () => {
    as(author);
    expect(await social.giveFg(activityId)).toEqual({ ok: false, error: "Você não pode dar FG no próprio treino." });
    const hidden = await makeActivity(author, "FOLLOWERS");
    as(fan);
    expect(await social.giveFg(hidden)).toEqual({ ok: false, error: "Você não tem acesso a isso." });
  });
});

describe("notifications page data (W-042, W-138)", () => {
  it("groups FGs on one workout, offers 'Seguir de volta', and marks only what was shown as seen", async () => {
    const me = await makeUser("inbox", { isPublic: true });
    const ana = await makeUser("ana", { isPublic: true });
    const bruno = await makeUser("bruno");
    const activityId = await makeActivity(me, "PUBLIC", "Push A");
    as(ana);
    await social.giveFg(activityId);
    await social.followUser(me);
    as(bruno);
    await social.giveFg(activityId);

    const page = await getNotifications(me, new Date());
    expect(page.unread).toBe(3);
    const fg = page.lines.find((l) => l.type === "FG_RECEIVED")!;
    expect(fg.key).toBe(`fg:${activityId}`);
    expect(fg.actors.map((a) => a.name)).toEqual(["Bruno", "Ana"]);
    expect(fg.workoutName).toBe("Push A");
    expect(fg.href).toBe(`/app/activity/${activityId}`);
    expect(fg.bucket).toBe("today");
    expect(fg.timeLabel).toBe("agora");
    const follower = page.lines.find((l) => l.type === "NEW_FOLLOWER")!;
    expect(follower.followBack).toEqual({ relation: "NONE", isPrivate: false });

    // Something arrives after the page was rendered: it stays unread.
    const upTo = page.newestAt!;
    await new Promise((r) => setTimeout(r, 5));
    const late = await makeUser("atrasada", { isPublic: true });
    as(late);
    await social.followUser(me);
    as(me);
    expect(await social.markNotificationsSeen(upTo)).toEqual({ ok: true, unread: 1 });
    expect(await social.markNotificationsSeen("not a date")).toMatchObject({ ok: false });

    // Following back: the button no longer applies.
    await social.followUser(ana);
    const again = await getNotifications(me, new Date());
    expect(again.lines.find((l) => l.type === "NEW_FOLLOWER" && l.actors[0].id === ana)?.followBack?.relation).toBe("FOLLOWING");
  });
});

describe("acting on someone else's graph", () => {
  it("answers only requests made to you; removing and unblocking touch only your own rows", async () => {
    const target = await makeUser("alvo-privado");
    const asker = await makeUser("pedinte");
    const intruder = await makeUser("intruso");
    const request = await prisma.followRequest.create({ data: { requesterId: asker, targetId: target } });
    await prisma.follow.create({ data: { followerId: asker, followingId: target } });
    await prisma.userBlock.create({ data: { blockerId: target, blockedId: intruder } });

    as(intruder);
    expect(await social.respondToFollowRequest(request.id, true)).toEqual({ ok: false, error: "Você não tem acesso a isso." });
    expect(await social.respondToFollowRequest("no-such-request", true)).toEqual({ ok: false, error: "Isso não existe mais." });
    // "Remove asker from my followers" / "unblock myself" as the intruder: nothing of the target's moves.
    expect(await social.removeFollower(asker)).toEqual({ ok: true, status: "REMOVED" });
    expect(await social.unblockUser(target)).toEqual({ ok: true, status: "UNBLOCKED" });
    expect((await prisma.followRequest.findUniqueOrThrow({ where: { id: request.id } })).status).toBe("PENDING");
    expect(await prisma.follow.count({ where: { followerId: asker, followingId: target } })).toBe(1);
    expect(await prisma.userBlock.count({ where: { blockerId: target, blockedId: intruder } })).toBe(1);
    as(null);
    expect(await social.respondToFollowRequest(request.id, true)).toEqual({ ok: false, error: SESSION_EXPIRED_ERROR });
  });
});

describe("removeFollower and blocking (W-141)", () => {
  it("removes a follower (their request too), keeping the other direction", async () => {
    const me = await makeUser("dona");
    const follower = await makeUser("seguidor", { isPublic: true });
    await prisma.follow.createMany({
      data: [
        { followerId: follower, followingId: me },
        { followerId: me, followingId: follower },
      ],
    });
    await prisma.followRequest.create({ data: { requesterId: follower, targetId: me, status: "ACCEPTED" } });
    as(me);
    expect((await getFollowers(me, 50)).people.map((p) => p.id)).toEqual([follower]);
    expect(await social.removeFollower(follower)).toEqual({ ok: true, status: "REMOVED" });
    expect(await prisma.follow.count({ where: { followerId: follower, followingId: me } })).toBe(0);
    expect(await prisma.followRequest.count({ where: { requesterId: follower, targetId: me } })).toBe(0);
    expect(await prisma.follow.count({ where: { followerId: me, followingId: follower } })).toBe(1);
  });

  it("blocks: follows, requests, notifications and cross FGs go both ways, counts recomputed; unblock", async () => {
    const me = await makeUser("bloqueia", { isPublic: true });
    const pest = await makeUser("chato", { isPublic: true });
    const bystander = await makeUser("outro", { isPublic: true });
    const mine = await makeActivity(me, "PUBLIC");
    const theirs = await makeActivity(pest, "PUBLIC");
    as(pest);
    await social.followUser(me);
    await social.giveFg(mine);
    as(bystander);
    await social.giveFg(mine);
    as(me);
    await social.followUser(pest);
    await social.giveFg(theirs);
    expect((await prisma.activity.findUniqueOrThrow({ where: { id: mine } })).fgCount).toBe(2);

    expect(await social.blockUser(pest)).toEqual({ ok: true, status: "BLOCKED" });
    expect(await prisma.follow.count({ where: { OR: [{ followerId: me, followingId: pest }, { followerId: pest, followingId: me }] } })).toBe(0);
    expect(await prisma.notification.count({ where: { OR: [{ recipientId: me, actorId: pest }, { recipientId: pest, actorId: me }] } })).toBe(0);
    expect(await prisma.activityFG.count({ where: { OR: [{ activityId: mine, userId: pest }, { activityId: theirs, userId: me }] } })).toBe(0);
    expect((await prisma.activity.findUniqueOrThrow({ where: { id: mine } })).fgCount).toBe(1);
    expect((await prisma.activity.findUniqueOrThrow({ where: { id: theirs } })).fgCount).toBe(0);
    expect((await getBlockedUsers(me)).map((u) => u.id)).toEqual([pest]);
    // Blocked: they can't follow or FG again.
    as(pest);
    expect(await social.followUser(me)).toEqual({ ok: false, error: "Não é possível interagir com esta conta." });
    expect(await social.giveFg(mine)).toEqual({ ok: false, error: "Você não tem acesso a isso." });

    as(me);
    expect(await social.blockUser(me)).toEqual({ ok: false, error: "Você não pode bloquear a si mesmo." });
    expect(await social.unblockUser(pest)).toEqual({ ok: true, status: "UNBLOCKED" });
    expect(await getBlockedUsers(me)).toEqual([]);
  });
});

describe("reportContent (decision 15)", () => {
  let author: string, reporter: string, publicActivity: string, followersActivity: string;
  beforeAll(async () => {
    author = await makeUser("denunciada", { isPublic: true });
    reporter = await makeUser("denunciante");
    publicActivity = await makeActivity(author, "PUBLIC", "Treino Público");
    followersActivity = await makeActivity(author, "FOLLOWERS");
  });

  it("files a workout report with the author and a snapshot, once while open", async () => {
    as(reporter);
    expect(await social.reportContent({ activityId: publicActivity, reason: "SPAM", details: "  propaganda  " })).toEqual({ ok: true, blocked: false });
    expect(await social.reportContent({ activityId: publicActivity, reason: "OTHER" })).toEqual({ ok: true, blocked: false });
    const reports = await prisma.userReport.findMany({ where: { reporterId: reporter } });
    expect(reports).toHaveLength(1);
    expect(reports[0].reportedUserId).toBe(author);
    expect(reports[0].details).toBe("propaganda");
    expect(reports[0].snapshot).toMatchObject({ kind: "activity", workoutName: "Treino Público", caption: "Hoje foi pesado", author: { id: author } });
  });

  it("refuses a bad reason, a workout you can't see, your own, and yourself", async () => {
    as(reporter);
    expect(await social.reportContent({ activityId: publicActivity, reason: "NOPE" as never })).toEqual({ ok: false, error: "Escolha um motivo." });
    expect(await social.reportContent({ activityId: followersActivity, reason: "SPAM" })).toEqual({ ok: false, error: "Você não tem acesso a isso." });
    expect(await social.reportContent({ reportedUserId: reporter, reason: "SPAM" })).toEqual({ ok: false, error: "Você não pode denunciar a si mesmo." });
    as(author);
    expect(await social.reportContent({ activityId: publicActivity, reason: "SPAM" })).toEqual({ ok: false, error: "Você não pode denunciar o próprio treino." });
  });

  it("still files a person report when your open report about their workout lost the post (deleted since)", async () => {
    const poster = await makeUser("apagou", { isPublic: true });
    const witness = await makeUser("testemunha");
    const post = await makeActivity(poster, "PUBLIC");
    as(witness);
    expect(await social.reportContent({ activityId: post, reason: "FAKE_DATA" })).toEqual({ ok: true, blocked: false });
    await prisma.activity.delete({ where: { id: post } });
    expect(await social.reportContent({ reportedUserId: poster, reason: "HARASSMENT" })).toEqual({ ok: true, blocked: false });
    // …and that person report, open, is what a second one repeats.
    expect(await social.reportContent({ reportedUserId: poster, reason: "SPAM" })).toEqual({ ok: true, blocked: false });
    const reports = await prisma.userReport.findMany({ where: { reporterId: witness }, orderBy: { createdAt: "asc" } });
    expect(reports.map((r) => [r.reason, r.activityId, (r.snapshot as { kind?: string }).kind])).toEqual([
      ["FAKE_DATA", null, "activity"],
      ["HARASSMENT", null, "user"],
    ]);
  });

  it("lets a link-only viewer report the workout they hold the link to", async () => {
    const token = "AbCdEfGhIjKlMnOp";
    await prisma.activity.update({ where: { id: followersActivity }, data: { shareToken: token, sharedAt: new Date() } });
    as(reporter);
    expect(await social.reportContent({ activityId: followersActivity, reason: "FAKE_DATA", shareToken: "wrongtokenwrong1" })).toEqual({
      ok: false,
      error: "Você não tem acesso a isso.",
    });
    expect(await social.reportContent({ activityId: followersActivity, reason: "FAKE_DATA", shareToken: token })).toEqual({ ok: true, blocked: false });
  });

  it("reports a person, says when they're already blocked, and stops at 10 a day", async () => {
    const heavy = await makeUser("denunciador");
    const targets = await Promise.all(Array.from({ length: 11 }, (_, i) => makeUser(`alvo${i}`, { isPublic: true })));
    await prisma.userBlock.create({ data: { blockerId: heavy, blockedId: targets[0] } });
    as(heavy);
    expect(await social.reportContent({ reportedUserId: targets[0], reason: "HARASSMENT" })).toEqual({ ok: true, blocked: true });
    const snap = (await prisma.userReport.findFirstOrThrow({ where: { reporterId: heavy } })).snapshot;
    expect(snap).toMatchObject({ kind: "user", user: { id: targets[0] } });
    for (let i = 1; i < 10; i++) {
      expect((await social.reportContent({ reportedUserId: targets[i], reason: "SPAM" })).ok).toBe(true);
    }
    expect(await social.reportContent({ reportedUserId: targets[10], reason: "SPAM" })).toEqual({
      ok: false,
      error: "Você enviou muitas denúncias hoje. Tente de novo amanhã.",
    });
  });
});

describe("admin e-mail on a new report", () => {
  it("mails each ADMIN_EMAILS address once when the queue goes from empty to not empty", async () => {
    const { notifyAdminsOfNewReport } = await import("@/lib/social/notification-reports");
    const addresses = [`${RUN_ID}-admin1@fgpower.test`, `${RUN_ID}-admin2@fgpower.test`];
    const saved = process.env.ADMIN_EMAILS;
    const mails = () => prisma.emailMessage.findMany({ where: { toEmail: { in: addresses }, kind: "ADMIN_REPORT" } });
    try {
      process.env.ADMIN_EMAILS = "";
      expect(await notifyAdminsOfNewReport({ reason: "SPAM" }, 1)).toBe(0);
      process.env.ADMIN_EMAILS = ` ${addresses[0].toUpperCase()}, ${addresses[1]} ,`;
      // More than one open: the admins already know there is work waiting.
      expect(await notifyAdminsOfNewReport({ reason: "SPAM" }, 2)).toBe(0);
      expect(await mails()).toHaveLength(0);
      expect(await notifyAdminsOfNewReport({ reason: "FAKE_DATA" }, 1)).toBe(2);
      const sent = await mails();
      expect(sent.map((m) => m.toEmail).sort()).toEqual([...addresses].sort());
      expect(sent[0].subject).toBe("FGPOWER · nova denúncia para revisar");
      expect(sent[0].devBody).toContain("Motivo: Dados falsos");
      expect(sent[0].devBody).toContain("/admin/reports");
      expect(sent[0].devBody).toContain("Você recebe porque está em ADMIN_EMAILS.");
    } finally {
      process.env.ADMIN_EMAILS = saved;
    }
  });
});
