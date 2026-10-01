import "dotenv/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { SESSION_EXPIRED_ERROR } from "@/lib/auth/session-expired";

/**
 * The owner's controls on a published workout (W-143), against the real
 * local Postgres: only the owner, only workouts, never a post moderation hid;
 * the session's visibility follows without touching its updatedAt (the 24 h
 * correction window); deleting keeps the workout (private) and takes the
 * FGs and their notifications with the post.
 */

const RUN = `owner-${Date.now()}`;
const OWNER = `${RUN}-owner`;
const FAN = `${RUN}-fan`;
let signedIn: string | null = OWNER;

vi.mock("@/lib/auth/require-user", () => ({
  requireUserOrThrow: async () => {
    if (!signedIn) throw new Error("UNAUTHORIZED");
    return { id: signedIn };
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { setActivityVisibility, deleteActivity } = await import("./activity-owner");

const SAVED_AT = new Date(Date.now() - 3 * 60 * 60 * 1000);

async function publishedWorkout(opts: { type?: "WORKOUT" | "MILESTONE"; moderated?: boolean } = {}) {
  const session = await prisma.workoutSession.create({
    data: { userId: OWNER, name: "Push A", status: "COMPLETED", startedAt: SAVED_AT, finishedAt: SAVED_AT, visibility: "FOLLOWERS" },
  });
  // Pin the session's updatedAt to its save: the actions must leave it there.
  await prisma.$executeRaw`UPDATE "WorkoutSession" SET "updatedAt" = ${SAVED_AT} WHERE id = ${session.id}`;
  const activity = await prisma.activity.create({
    data: {
      userId: OWNER,
      type: opts.type ?? "WORKOUT",
      sessionId: opts.type === "MILESTONE" ? null : session.id,
      visibility: "FOLLOWERS",
      moderatedAt: opts.moderated ? new Date() : null,
      summary: { workoutName: "Push A", totalWorkingSets: 3, prs: [], exercises: [] },
    },
  });
  return { session, activity };
}

beforeAll(async () => {
  for (const id of [OWNER, FAN]) {
    await prisma.user.create({ data: { id, name: id, email: `${id}@fgpower.test`, emailVerified: true } });
    await prisma.profile.create({ data: { userId: id, displayName: id } });
  }
});

beforeEach(() => {
  signedIn = OWNER;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [OWNER, FAN] } } });
  await prisma.$disconnect();
});

describe("setActivityVisibility", () => {
  it("changes the post and its workout, keeping the workout's updatedAt", async () => {
    const { session, activity } = await publishedWorkout();
    expect(await setActivityVisibility(activity.id, "PRIVATE")).toEqual({ ok: true, visibility: "PRIVATE" });
    const after = await prisma.workoutSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(after.visibility).toBe("PRIVATE");
    expect(after.updatedAt.getTime()).toBe(SAVED_AT.getTime());
    expect((await prisma.activity.findUniqueOrThrow({ where: { id: activity.id } })).visibility).toBe("PRIVATE");

    expect(await setActivityVisibility(activity.id, "PUBLIC")).toEqual({ ok: true, visibility: "PUBLIC" });
    expect((await prisma.workoutSession.findUniqueOrThrow({ where: { id: session.id } })).visibility).toBe("PUBLIC");
  });

  it("refuses someone else, a stamp, a moderated post, an unknown value and a missing post", async () => {
    const { activity } = await publishedWorkout();
    signedIn = FAN;
    expect(await setActivityVisibility(activity.id, "PUBLIC")).toEqual({ ok: false, error: "Só quem publicou pode mudar esta publicação." });
    signedIn = OWNER;
    const stamp = await publishedWorkout({ type: "MILESTONE" });
    expect(await setActivityVisibility(stamp.activity.id, "PUBLIC")).toMatchObject({ ok: false });
    const hidden = await publishedWorkout({ moderated: true });
    expect(await setActivityVisibility(hidden.activity.id, "PUBLIC")).toEqual({
      ok: false,
      error: "Esta publicação foi ocultada pela moderação.",
    });
    expect((await prisma.activity.findUniqueOrThrow({ where: { id: hidden.activity.id } })).visibility).toBe("FOLLOWERS");
    // @ts-expect-error — a value the radio group never sends
    expect(await setActivityVisibility(activity.id, "EVERYONE")).toMatchObject({ ok: false });
    expect(await setActivityVisibility(`${RUN}-nope`, "PUBLIC")).toEqual({ ok: false, error: "Esta publicação não existe mais." });
  });

  it("says the session expired", async () => {
    const { activity } = await publishedWorkout();
    signedIn = null;
    expect(await setActivityVisibility(activity.id, "PUBLIC")).toEqual({ ok: false, error: SESSION_EXPIRED_ERROR });
    expect(await deleteActivity(activity.id)).toEqual({ ok: false, error: SESSION_EXPIRED_ERROR });
  });
});

describe("deleteActivity", () => {
  it("deletes the post with its FGs and their notifications; the workout stays, private, updatedAt untouched", async () => {
    const { session, activity } = await publishedWorkout();
    await prisma.activityFG.create({ data: { activityId: activity.id, userId: FAN } });
    await prisma.notification.create({
      data: { recipientId: OWNER, actorId: FAN, type: "FG_RECEIVED", activityId: activity.id, dedupeKey: `fg:${activity.id}:${FAN}` },
    });

    expect(await deleteActivity(activity.id)).toEqual({ ok: true });
    expect(await prisma.activity.findUnique({ where: { id: activity.id } })).toBeNull();
    expect(await prisma.activityFG.count({ where: { activityId: activity.id } })).toBe(0);
    expect(await prisma.notification.count({ where: { activityId: activity.id } })).toBe(0);
    const kept = await prisma.workoutSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(kept).toMatchObject({ status: "COMPLETED", visibility: "PRIVATE" });
    expect(kept.updatedAt.getTime()).toBe(SAVED_AT.getTime());
    // A second tap (another tab): the post is already gone.
    expect(await deleteActivity(activity.id)).toEqual({ ok: false, error: "Esta publicação não existe mais." });
  });

  it("refuses someone else's post and a moderated one", async () => {
    const { activity } = await publishedWorkout();
    signedIn = FAN;
    expect(await deleteActivity(activity.id)).toMatchObject({ ok: false });
    signedIn = OWNER;
    const hidden = await publishedWorkout({ moderated: true });
    expect(await deleteActivity(hidden.activity.id)).toEqual({ ok: false, error: "Esta publicação foi ocultada pela moderação." });
    expect(await prisma.activity.count({ where: { id: { in: [activity.id, hidden.activity.id] } } })).toBe(2);
  });
});

describe("an admin's hide landing while the owner acts", () => {
  it("wins: the owner's change or delete, checked just before it, doesn't undo it", async () => {
    const acts = [(id: string) => setActivityVisibility(id, "PUBLIC"), (id: string) => deleteActivity(id)];
    for (const act of acts) {
      const { session, activity } = await publishedWorkout();
      // "Ocultar treino" commits right after the action read the post (its check passed).
      const read = prisma.activity.findUnique.bind(prisma.activity);
      const spy = vi.spyOn(prisma.activity, "findUnique").mockImplementationOnce((async (args: Parameters<typeof read>[0]) => {
        const row = await read(args);
        await prisma.activity.update({ where: { id: activity.id }, data: { visibility: "PRIVATE", moderatedAt: new Date() } });
        await prisma.workoutSession.update({ where: { id: session.id }, data: { visibility: "PRIVATE" } });
        return row;
      }) as never);
      expect(await act(activity.id)).toEqual({ ok: false, error: "Esta publicação foi ocultada pela moderação." });
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
      expect(await prisma.activity.findUnique({ where: { id: activity.id } })).toMatchObject({ visibility: "PRIVATE" });
      expect((await prisma.workoutSession.findUniqueOrThrow({ where: { id: session.id } })).visibility).toBe("PRIVATE");
    }
  });
});
