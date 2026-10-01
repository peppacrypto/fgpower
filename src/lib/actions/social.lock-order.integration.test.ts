import "dotenv/config";
import { afterAll, describe, expect, it, vi } from "vitest";

/**
 * Taking an FG back, a block and a post's deletion at the same moment, against
 * the real local Postgres. A post's deletion (its owner's "Excluir publicação",
 * a moderator's, "Excluir treino") takes the post's row, then cascades to its
 * FGs and their notifications. "Remover FG" deleted its FG row before writing
 * the post's count, and a block deleted the two people's notifications and FGs
 * before recounting the posts: each held a row the deletion needed while it
 * waited on the post, so Postgres aborted one of them (a deadlock). Both now
 * take the posts' rows first, as the deletion does. Each case holds the first
 * action inside its transaction, where the old order deadlocked, until the
 * second one waits on it. The last case holds a block after it read the FGs
 * between the two, while one of them gives another FG: the block deletes only
 * the FGs on the posts it locked and recounts, so no count is left off.
 */

const gate = vi.hoisted(() => ({
  armed: null as { model: "activityFG" | "notification"; at: "before" | "after" } | null,
  reached: () => {},
  release: Promise.resolve(),
}));

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  /** The armed deleteMany waits for the release, in its transaction, before or after its write. */
  async function held<T>(model: "activityFG" | "notification", write: () => Promise<T>): Promise<T> {
    const at = gate.armed?.model === model ? gate.armed.at : null;
    if (at) gate.armed = null;
    if (at === "before") {
      gate.reached();
      await gate.release;
    }
    const result = await write();
    if (at === "after") {
      gate.reached();
      await gate.release;
    }
    return result;
  }
  const prisma = real.prisma.$extends({
    query: {
      activityFG: {
        deleteMany: ({ args, query }) => held("activityFG", () => query(args)),
      },
      notification: {
        deleteMany: ({ args, query }) => held("notification", () => query(args)),
      },
    },
  });
  return { ...real, prisma };
});

const RUN_ID = `fglock-${Date.now()}`;
let current: { id: string; email: string } | null = null;
vi.mock("@/lib/auth/require-user", () => ({
  requireUserOrThrow: async () => {
    if (!current) throw new Error("UNAUTHORIZED");
    return current;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: () => {},
}));

const { prisma } = await import("@/lib/db");
const { notificationKey } = await import("@/lib/social/notifications");
const { giveFg, removeFg, blockUser } = await import("./social");
const { deleteActivity } = await import("./activity-owner");

const userIds: string[] = [];
async function makeUser(label: string) {
  const id = `${RUN_ID}-${label}`;
  await prisma.user.create({ data: { id, name: label, email: `${id}@fgpower.test`, emailVerified: true } });
  userIds.push(id);
  return id;
}
const as = (id: string) => {
  current = { id, email: `${id}@fgpower.test` };
};

/** The owner's workout, posted to followers, with the fan's FG on it and the FG_RECEIVED the owner hasn't read. */
async function fgOnAPost(label: string) {
  const owner = await makeUser(`${label}-owner`);
  const fan = await makeUser(`${label}-fan`);
  const at = new Date(Date.now() - 3_600_000);
  const session = await prisma.workoutSession.create({
    data: { userId: owner, name: "Pernas", status: "COMPLETED", startedAt: at, finishedAt: at, visibility: "FOLLOWERS", updatedAt: at },
  });
  const post = await prisma.activity.create({
    data: { userId: owner, type: "WORKOUT", sessionId: session.id, visibility: "FOLLOWERS", summary: { workoutName: "Pernas" }, fgCount: 1 },
  });
  await prisma.activityFG.create({ data: { activityId: post.id, userId: fan } });
  await prisma.notification.create({
    data: { recipientId: owner, actorId: fan, type: "FG_RECEIVED", activityId: post.id, dedupeKey: notificationKey.fg(post.id, fan) },
  });
  return { owner, fan, postId: post.id, sessionId: session.id };
}

/** Arms the gate: the next deleteMany on `model` is held there until `release()`. */
function holdAt(model: "activityFG" | "notification", at: "before" | "after") {
  let release!: () => void;
  gate.release = new Promise<void>((resolve) => (release = resolve));
  const reached = new Promise<void>((resolve) => (gate.reached = resolve));
  gate.armed = { model, at };
  return { reached, release };
}

/**
 * Until the second action waits on a row lock (the held one has a row it needs), or is done
 * without waiting (nothing it needs is held there: that order can't deadlock).
 */
async function untilWaitingOrDone(second: Promise<unknown>) {
  let done = false;
  second.then(
    () => (done = true),
    () => (done = true),
  );
  for (let i = 0; i < 100 && !done; i++) {
    const [row] = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock' AND query ILIKE '%"Activity"%'`;
    if (row.n > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (!done) throw new Error("the second action neither waited on the held one nor finished");
}

/** A settled call, as the assertion shows it: the value, or why it failed (a deadlock names itself). */
function settled(result: PromiseSettledResult<unknown>) {
  return result.status === "fulfilled" ? result.value : `rejected: ${String((result.reason as Error)?.message ?? result.reason)}`;
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe("an FG taken back, a block and a post's deletion, at the same moment", () => {
  it("'Excluir publicação' waits for 'Remover FG' held between its FG and the count; both land", async () => {
    const { owner, fan, postId, sessionId } = await fgOnAPost("rm-del");
    const hold = holdAt("activityFG", "after");
    as(fan);
    const removal = removeFg(postId);
    await hold.reached;
    as(owner);
    const deletion = deleteActivity(postId);
    await untilWaitingOrDone(deletion);
    hold.release();

    const [removed, deleted] = await Promise.allSettled([removal, deletion]);
    expect(settled(removed)).toEqual({ ok: true, fgCount: 0 });
    expect(settled(deleted)).toEqual({ ok: true });
    expect(await prisma.activity.count({ where: { id: postId } })).toBe(0);
    expect(await prisma.activityFG.count({ where: { activityId: postId } })).toBe(0);
    expect(await prisma.notification.count({ where: { activityId: postId } })).toBe(0);
    expect((await prisma.workoutSession.findUniqueOrThrow({ where: { id: sessionId } })).visibility).toBe("PRIVATE");
  });

  it("a block waits for 'Remover FG' held on the post before its FG; both land and the count is right", async () => {
    const { owner, fan, postId } = await fgOnAPost("rm-block");
    const hold = holdAt("activityFG", "before");
    as(fan);
    const removal = removeFg(postId);
    await hold.reached;
    as(owner);
    const block = blockUser(fan);
    await untilWaitingOrDone(block);
    hold.release();

    const [removed, blocked] = await Promise.allSettled([removal, block]);
    expect(settled(removed)).toEqual({ ok: true, fgCount: 0 });
    expect(settled(blocked)).toEqual({ ok: true, status: "BLOCKED" });
    expect(await prisma.activity.findUniqueOrThrow({ where: { id: postId }, select: { fgCount: true } })).toEqual({ fgCount: 0 });
    expect(await prisma.activityFG.count({ where: { activityId: postId } })).toBe(0);
    expect(await prisma.notification.count({ where: { recipientId: owner, actorId: fan } })).toBe(0);
  });

  it("'Excluir publicação' waits for a block held after the notifications between the two; both land", async () => {
    const { owner, fan, postId } = await fgOnAPost("block-del");
    const hold = holdAt("notification", "after");
    as(fan);
    const block = blockUser(owner);
    await hold.reached;
    as(owner);
    const deletion = deleteActivity(postId);
    await untilWaitingOrDone(deletion);
    hold.release();

    const [blocked, deleted] = await Promise.allSettled([block, deletion]);
    expect(settled(blocked)).toEqual({ ok: true, status: "BLOCKED" });
    expect(settled(deleted)).toEqual({ ok: true });
    expect(await prisma.activity.count({ where: { id: postId } })).toBe(0);
    expect(await prisma.activityFG.count({ where: { activityId: postId } })).toBe(0);
    expect(await prisma.userBlock.count({ where: { blockerId: fan, blockedId: owner } })).toBe(1);
  });

  it("an FG given on another of the owner's posts while a block runs: every post's count still equals its FGs", async () => {
    const { owner, fan, postId } = await fgOnAPost("block-fg");
    const at = new Date(Date.now() - 7_200_000);
    const session = await prisma.workoutSession.create({
      data: { userId: owner, name: "Costas", status: "COMPLETED", startedAt: at, finishedAt: at, visibility: "PUBLIC", updatedAt: at },
    });
    const other = await prisma.activity.create({
      data: { userId: owner, type: "WORKOUT", sessionId: session.id, visibility: "PUBLIC", summary: { workoutName: "Costas" } },
    });
    // Held between its read of the FGs between the two (the first post's) and its delete of them.
    const hold = holdAt("notification", "after");
    as(owner);
    const block = blockUser(fan);
    await hold.reached;
    as(fan);
    const given = await giveFg(other.id);
    hold.release();

    const [blocked] = await Promise.allSettled([block]);
    expect(given).toEqual({ ok: true, fgCount: 1 });
    expect(settled(blocked)).toEqual({ ok: true, status: "BLOCKED" });
    expect(await prisma.activityFG.count({ where: { activityId: postId } })).toBe(0);
    // Not a post the block read: the FG stays, as one given just after the block would, and counts.
    expect(await prisma.activityFG.count({ where: { activityId: other.id } })).toBe(1);
    for (const id of [postId, other.id]) {
      const { fgCount } = await prisma.activity.findUniqueOrThrow({ where: { id }, select: { fgCount: true } });
      expect(fgCount).toBe(await prisma.activityFG.count({ where: { activityId: id } }));
    }
  });
});
