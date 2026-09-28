import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { countUnread, createNotification, markSeen, notificationKey, retractNotification } from "./notifications";

/**
 * The notification service against the real local Postgres: one row per
 * event (the unique recipient + dedupeKey index), self and blocked pairs
 * skipped, re-arming, retracting and "seen".
 */

const RUN_ID = `notif-${Date.now()}`;
const userIds: string[] = [];

async function makeUser(label: string) {
  const id = `${RUN_ID}-${label}`;
  await prisma.user.create({ data: { id, name: label, email: `${id}@fgpower.test`, emailVerified: true } });
  userIds.push(id);
  return id;
}

let owner: string, fan: string, other: string, blocker: string;

beforeAll(async () => {
  owner = await makeUser("owner");
  fan = await makeUser("fan");
  other = await makeUser("other");
  blocker = await makeUser("blocker");
  await prisma.userBlock.create({ data: { blockerId: blocker, blockedId: owner } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

const rows = (recipientId: string, dedupeKey?: string) =>
  prisma.notification.findMany({ where: { recipientId, ...(dedupeKey ? { dedupeKey } : {}) } });

describe("createNotification", () => {
  it("keeps one row per key ('keep')", async () => {
    const key = notificationKey.fg("act-1", fan);
    const input = { recipientId: owner, actorId: fan, type: "FG_RECEIVED" as const, dedupeKey: key };
    expect(await createNotification(prisma, input)).toEqual({ created: true, rearmed: false });
    expect(await createNotification(prisma, input)).toEqual({ created: false, rearmed: false });
    expect(await rows(owner, key)).toHaveLength(1);
  });

  it("never dedupes a NULL key", async () => {
    const input = { recipientId: other, actorId: fan, type: "NEW_FOLLOWER" as const, dedupeKey: null };
    await createNotification(prisma, input);
    await createNotification(prisma, input);
    expect(await prisma.notification.count({ where: { recipientId: other, dedupeKey: null } })).toBe(2);
  });

  it("skips yourself and blocked pairs (either direction)", async () => {
    expect(
      await createNotification(prisma, { recipientId: fan, actorId: fan, type: "NEW_FOLLOWER", dedupeKey: notificationKey.follower(fan) }),
    ).toEqual({ created: false, rearmed: false });
    expect(
      await createNotification(prisma, { recipientId: owner, actorId: blocker, type: "NEW_FOLLOWER", dedupeKey: notificationKey.follower(blocker) }),
    ).toEqual({ created: false, rearmed: false });
    expect(
      await createNotification(prisma, { recipientId: blocker, actorId: owner, type: "NEW_FOLLOWER", dedupeKey: notificationKey.follower(owner) }),
    ).toEqual({ created: false, rearmed: false });
    expect(await rows(fan)).toHaveLength(0);
    expect(await rows(blocker)).toHaveLength(0);
  });

  it("creates achievement rows already read, so they never count as unread", async () => {
    const before = await countUnread(fan);
    await createNotification(prisma, {
      recipientId: fan,
      actorId: null,
      type: "PERSONAL_RECORD",
      dedupeKey: notificationKey.records("session-x"),
      read: true,
      data: { count: 1 },
    });
    const [row] = await rows(fan, notificationKey.records("session-x"));
    expect(row.readAt).not.toBeNull();
    expect(row.data).toEqual({ count: 1 });
    expect(await countUnread(fan)).toBe(before);
  });

  it("re-arms a row as new ('rearm')", async () => {
    const key = notificationKey.request(fan);
    const old = new Date(Date.now() - 86_400_000);
    await createNotification(prisma, { recipientId: other, actorId: fan, type: "FOLLOW_REQUEST", dedupeKey: key }, old);
    await prisma.notification.updateMany({ where: { recipientId: other, dedupeKey: key }, data: { readAt: old } });
    const result = await createNotification(prisma, {
      recipientId: other,
      actorId: fan,
      type: "FOLLOW_REQUEST",
      dedupeKey: key,
      onDuplicate: "rearm",
    });
    expect(result).toEqual({ created: false, rearmed: true });
    const [row] = await rows(other, key);
    expect(row.readAt).toBeNull();
    expect(row.createdAt.getTime()).toBeGreaterThan(old.getTime());
  });

  it("re-arms only rows read before the cutoff ({ rearmIfReadBefore })", async () => {
    const key = notificationKey.accepted(fan);
    const input = { recipientId: owner, actorId: fan, type: "FOLLOW_ACCEPTED" as const, dedupeKey: key };
    const cutoff = new Date(Date.now() - 30 * 86_400_000);
    await createNotification(prisma, input);
    // Unread: stays as it is.
    expect(await createNotification(prisma, { ...input, onDuplicate: { rearmIfReadBefore: cutoff } })).toEqual({
      created: false,
      rearmed: false,
    });
    // Read recently: stays read.
    await prisma.notification.updateMany({ where: { recipientId: owner, dedupeKey: key }, data: { readAt: new Date() } });
    expect((await createNotification(prisma, { ...input, onDuplicate: { rearmIfReadBefore: cutoff } })).rearmed).toBe(false);
    // Read before the cutoff: notifies again.
    await prisma.notification.updateMany({
      where: { recipientId: owner, dedupeKey: key },
      data: { readAt: new Date(cutoff.getTime() - 1000) },
    });
    expect((await createNotification(prisma, { ...input, onDuplicate: { rearmIfReadBefore: cutoff } })).rearmed).toBe(true);
    const [row] = await rows(owner, key);
    expect(row.readAt).toBeNull();
    expect(await rows(owner, key)).toHaveLength(1);
  });

  it("works inside an interactive transaction", async () => {
    const key = notificationKey.block("enrollment-tx");
    await prisma.$transaction(async (tx) => {
      await createNotification(tx, { recipientId: other, actorId: null, type: "PROGRAM_COMPLETED", dedupeKey: key, read: true });
      await createNotification(tx, { recipientId: other, actorId: null, type: "PROGRAM_COMPLETED", dedupeKey: key, read: true });
    });
    expect(await rows(other, key)).toHaveLength(1);
  });

  it("two concurrent writers of one event leave one row", async () => {
    const key = notificationKey.follower(other);
    const input = { recipientId: fan, actorId: other, type: "NEW_FOLLOWER" as const, dedupeKey: key };
    const results = await Promise.all([createNotification(prisma, input), createNotification(prisma, input)]);
    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(await rows(fan, key)).toHaveLength(1);
  });
});

describe("retractNotification", () => {
  it("removes an unread row, keeps a read one unless asked", async () => {
    const key = notificationKey.fg("act-retract", fan);
    await createNotification(prisma, { recipientId: owner, actorId: fan, type: "FG_RECEIVED", dedupeKey: key });
    expect(await retractNotification(prisma, { recipientId: owner, dedupeKey: key })).toBe(1);
    expect(await rows(owner, key)).toHaveLength(0);

    await createNotification(prisma, { recipientId: owner, actorId: fan, type: "FG_RECEIVED", dedupeKey: key });
    await prisma.notification.updateMany({ where: { recipientId: owner, dedupeKey: key }, data: { readAt: new Date() } });
    expect(await retractNotification(prisma, { recipientId: owner, dedupeKey: key })).toBe(0);
    expect(await rows(owner, key)).toHaveLength(1);
    expect(await retractNotification(prisma, { recipientId: owner, dedupeKey: key, onlyUnread: false })).toBe(1);
  });
});

describe("countUnread / markSeen", () => {
  it("marks only rows up to the rendered newest and returns what is left", async () => {
    const recipient = await makeUser("inbox");
    const t0 = new Date(Date.now() - 60_000);
    const t1 = new Date(Date.now() - 30_000);
    const t2 = new Date();
    await createNotification(prisma, { recipientId: recipient, actorId: fan, type: "NEW_FOLLOWER", dedupeKey: notificationKey.follower(fan) }, t0);
    await createNotification(prisma, { recipientId: recipient, actorId: other, type: "NEW_FOLLOWER", dedupeKey: notificationKey.follower(other) }, t1);
    await createNotification(prisma, { recipientId: recipient, actorId: owner, type: "NEW_FOLLOWER", dedupeKey: notificationKey.follower(owner) }, t2);
    expect(await countUnread(recipient)).toBe(3);
    expect(await markSeen(recipient, t1)).toBe(1);
    expect(await countUnread(recipient)).toBe(1);
    // Another user's rows are untouched.
    expect(await countUnread(owner)).toBeGreaterThan(0);
  });
});
