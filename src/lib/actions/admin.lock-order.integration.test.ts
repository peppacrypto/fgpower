import "dotenv/config";
import { afterAll, describe, expect, it, vi } from "vitest";

/**
 * An owner's share and an admin's decision on the same post, at the same
 * moment, against the real local Postgres. Every writer takes the post's row
 * first, then its workout's: the share (lib/social/publish.ts), the owner's
 * own actions (activity-owner.ts) and "Ocultar treino". "Excluir publicação"
 * took the workout first, so with a share between its two writes the two
 * waited on each other: Postgres aborted one (a deadlock) and that person
 * got an error. Here the share is held right between its writes (it holds
 * the post; its workout's write is next) until the moderator's transaction
 * waits on it.
 */

const gate = vi.hoisted(() => ({
  armed: false,
  reached: () => {},
  release: Promise.resolve(),
}));

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const prisma = real.prisma.$extends({
    query: {
      workoutSession: {
        async update({ args, query }) {
          // The share's workout write (to PUBLIC), in its transaction, after the post's.
          if (gate.armed && (args.data as { visibility?: unknown }).visibility === "PUBLIC") {
            gate.armed = false;
            gate.reached();
            await gate.release;
          }
          return query(args);
        },
      },
    },
  });
  return { ...real, prisma };
});

const RUN_ID = `s4lock-${Date.now()}`;
let current: { id: string; email: string; role: string } | null = null;
vi.mock("@/lib/auth/require-user", () => ({
  requireAdminOrThrow: async () => {
    if (!current) throw new Error("UNAUTHORIZED");
    return current;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { prisma } = await import("@/lib/db");
const { moderateReport } = await import("./admin");
const { upsertWorkoutActivity } = await import("@/lib/social/publish");

const userIds: string[] = [];
async function makeUser(label: string, role = "user") {
  const id = `${RUN_ID}-${label}`;
  await prisma.user.create({ data: { id, name: label, email: `${id}@fgpower.test`, emailVerified: true, role } });
  userIds.push(id);
  return { id, email: `${id}@fgpower.test`, role };
}

/** A finished workout posted to followers, and a report about the post. */
async function reportedPost(ownerId: string, reporterId: string) {
  const at = new Date(Date.now() - 3_600_000);
  const session = await prisma.workoutSession.create({
    data: { userId: ownerId, name: "Pernas", status: "COMPLETED", startedAt: at, finishedAt: at, visibility: "FOLLOWERS", updatedAt: at },
  });
  const activity = await prisma.activity.create({
    data: { userId: ownerId, type: "WORKOUT", sessionId: session.id, visibility: "FOLLOWERS", summary: { workoutName: "Pernas" } },
  });
  const report = await prisma.userReport.create({
    data: { reporterId, reportedUserId: ownerId, activityId: activity.id, reason: "SPAM" },
  });
  return { sessionId: session.id, activityId: activity.id, reportId: report.id };
}

/** Until the moderator's transaction waits on a row lock of the post (the share holds it). */
async function moderatorWaiting() {
  for (let i = 0; i < 100; i++) {
    const [row] = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock' AND query ILIKE '%"Activity"%'`;
    if (row.n > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("the moderator's transaction never waited on the share");
}

/** A settled call, as the assertion shows it: the value, or why it failed (a deadlock names itself). */
function settled(result: PromiseSettledResult<unknown>) {
  return result.status === "fulfilled" ? result.value : `rejected: ${String((result.reason as Error)?.message ?? result.reason)}`;
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe("a share and a moderation decision on the same post, at the same moment", () => {
  it.each([
    { action: "DELETE", button: "Excluir publicação" },
    { action: "HIDE", button: "Ocultar treino" },
  ] as const)("$action ($button) waits for the share and then lands; neither fails", async ({ action }) => {
    const mod = await makeUser(`mod-${action}`, "admin");
    const owner = await makeUser(`owner-${action}`);
    const reporter = await makeUser(`rep-${action}`);
    const { sessionId, activityId, reportId } = await reportedPost(owner.id, reporter.id);

    let release!: () => void;
    gate.release = new Promise<void>((resolve) => (release = resolve));
    const reached = new Promise<void>((resolve) => (gate.reached = resolve));
    gate.armed = true;

    // The owner makes the post public: it takes the post's row, then waits (held) before its workout's.
    const share = upsertWorkoutActivity({ userId: owner.id, sessionId, visibility: "PUBLIC", showDetailedLoads: false });
    await reached;
    // The moderator decides meanwhile, and waits on the post's row.
    current = mod;
    const decision = moderateReport(reportId, action);
    await moderatorWaiting();
    release();

    const [shared, decided] = await Promise.allSettled([share, decision]);
    expect(settled(shared)).toMatchObject({ id: activityId, visibility: "PUBLIC" });
    expect(settled(decided)).toEqual({ ok: true, status: "ACTIONED", resolved: 1 });

    // The decision came last, and stands.
    const post = await prisma.activity.findUnique({ where: { id: activityId }, select: { visibility: true, moderatedAt: true } });
    if (action === "DELETE") expect(post).toBeNull();
    else expect(post).toMatchObject({ visibility: "PRIVATE", moderatedAt: expect.any(Date) });
    expect((await prisma.workoutSession.findUniqueOrThrow({ where: { id: sessionId } })).visibility).toBe("PRIVATE");
    expect((await prisma.userReport.findUniqueOrThrow({ where: { id: reportId } })).status).toBe("ACTIONED");
  });
});
