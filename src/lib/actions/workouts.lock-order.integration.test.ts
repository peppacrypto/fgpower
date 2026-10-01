import "dotenv/config";
import { afterAll, expect, it, vi } from "vitest";

/**
 * "Excluir treino" and a share of the same workout at the same moment, against
 * the real local Postgres. The share takes the post's row, then the workout's
 * (lib/social/publish.ts, as the moderation and activity-owner.ts do); the
 * delete locked the workout first and reached the post through the cascade,
 * so with the share between its two writes the two waited on each other and
 * Postgres aborted the delete (a deadlock). Here the share is held right
 * between its writes until the delete waits on it.
 */

const gate = vi.hoisted(() => ({ armed: false, reached: () => {}, release: Promise.resolve() }));

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

const OWNER = `wlock-${Date.now()}-owner`;
vi.mock("@/lib/auth/require-user", () => ({ requireUserOrThrow: async () => ({ id: OWNER }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
class Redirected extends Error {
  constructor(public url: string) {
    super(`REDIRECT ${url}`);
  }
}
vi.mock("next/navigation", () => ({
  RedirectType: { replace: "replace", push: "push" },
  redirect: (url: string) => {
    throw new Redirected(url);
  },
}));

const { prisma } = await import("@/lib/db");
const { upsertWorkoutActivity } = await import("@/lib/social/publish");
const { deleteWorkoutSession } = await import("./workouts");

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: OWNER } });
  await prisma.$disconnect();
});

it("'Excluir treino' waits for a share of the same workout, then deletes it; neither fails", async () => {
  await prisma.user.create({ data: { id: OWNER, name: "owner", email: `${OWNER}@fgpower.test`, emailVerified: true } });
  const at = new Date(Date.now() - 3_600_000);
  const session = await prisma.workoutSession.create({
    data: { userId: OWNER, name: "Pernas", status: "COMPLETED", startedAt: at, finishedAt: at, visibility: "FOLLOWERS", updatedAt: at },
  });
  await prisma.activity.create({
    data: { userId: OWNER, type: "WORKOUT", sessionId: session.id, visibility: "FOLLOWERS", summary: { workoutName: "Pernas" } },
  });

  let release!: () => void;
  gate.release = new Promise<void>((resolve) => (release = resolve));
  const reached = new Promise<void>((resolve) => (gate.reached = resolve));
  gate.armed = true;
  const share = upsertWorkoutActivity({ userId: OWNER, sessionId: session.id, visibility: "PUBLIC", showDetailedLoads: false });
  await reached;
  const deletion = deleteWorkoutSession(session.id);
  // Until the delete's transaction waits on a row lock (the share holds the post).
  for (let i = 0; ; i++) {
    const [row] = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock'
        AND (query ILIKE '%"Activity"%' OR query ILIKE '%"WorkoutSession"%')`;
    if (row.n > 0) break;
    if (i > 100) throw new Error("the delete never waited on the share");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  release();

  const [shared, deleted] = await Promise.allSettled([share, deletion]);
  expect(shared.status).toBe("fulfilled");
  const landed = deleted.status === "rejected" && deleted.reason instanceof Redirected ? deleted.reason.url : deleted;
  expect(landed).toBe("/app/today?excluido=1");
  expect(await prisma.workoutSession.count({ where: { id: session.id } })).toBe(0);
  expect(await prisma.activity.count({ where: { sessionId: session.id } })).toBe(0);
});
