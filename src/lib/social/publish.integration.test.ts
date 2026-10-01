import "dotenv/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { SESSION_EXPIRED_ERROR } from "@/lib/auth/session-expired";

/**
 * Publishing and sharing a finished workout (W-048 auto-publish, W-008 share
 * links, D-A, W-044's private → public switch), against the real local
 * Postgres: a workout carries the profile's defaults from the moment it is
 * opened and is published that way when it's finished; a share link opens
 * one workout, is minted once per tap-race, shows the loads as chosen and
 * dies when revoked or moderated; the privacy settings do what they say.
 */

const RUN_ID = `c3pub-${Date.now()}`;
const OWNER = `${RUN_ID}-owner`;
const OTHER = `${RUN_ID}-other`;
const REQUESTER = `${RUN_ID}-req`;
let currentUser: string | null = OWNER;

vi.mock("@/lib/auth/require-user", () => ({
  requireUserOrThrow: async () => {
    if (!currentUser) throw new Error("UNAUTHORIZED");
    return { id: currentUser };
  },
  getCurrentSession: async () => (currentUser ? { user: { id: currentUser } } : null),
}));
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

const workouts = await import("@/lib/actions/workouts");
const activities = await import("@/lib/actions/activities");
const profileActions = await import("@/lib/actions/profile");
const { publishOnFinish } = await import("./publish");
const { getSharedWorkout } = await import("@/lib/data/share");

let exerciseIds: string[];
let dayId: string;

async function redirectOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (err) {
    if (err instanceof Redirected) return err.url;
    throw err;
  }
  throw new Error("expected a redirect");
}

async function startWorkout(): Promise<string> {
  const url = await redirectOf(workouts.startAdHocWorkoutSession(dayId));
  return url.split("/")[3].split("?")[0];
}

/** Opens the day, ✓'s one set of its first exercise at `weightKg` and finishes. */
async function train(weightKg: number, reps = 10): Promise<string> {
  const sessionId = await startWorkout();
  const set = await prisma.setLog.findFirstOrThrow({
    where: { sessionId, setType: "WORKING" },
    orderBy: [{ exerciseLog: { sortOrder: "asc" } }, { setNumber: "asc" }],
  });
  expect(await workouts.logSet({ setLogId: set.id, weightKg, reps, rir: null })).toEqual({ ok: true });
  expect(await redirectOf(workouts.finishWorkoutSession(sessionId))).toBe(`/app/workout/${sessionId}/summary`);
  return sessionId;
}

async function setDefaults(visibility: "PRIVATE" | "FOLLOWERS" | "PUBLIC", showLoadsPublicly = false) {
  await prisma.profile.update({ where: { userId: OWNER }, data: { defaultWorkoutVisibility: visibility, showLoadsPublicly } });
}

async function tokenOf(sessionId: string) {
  return (await prisma.activity.findUnique({ where: { sessionId }, select: { shareToken: true } }))?.shareToken ?? null;
}

beforeAll(async () => {
  for (const id of [OWNER, OTHER, REQUESTER]) {
    await prisma.user.create({
      data: { id, name: id, email: `${id}@fgpower.test`, emailVerified: true, username: id.replace(/[^a-z0-9]/g, "").slice(-20) },
    });
    await prisma.profile.create({ data: { userId: id, displayName: id.endsWith("owner") ? "Dona" : "Outra", onboardingCompletedAt: new Date() } });
  }
  exerciseIds = (
    await prisma.exercise.findMany({
      where: { isPublished: true, equipment: { category: "FREE_WEIGHT" } },
      select: { id: true },
      take: 2,
      orderBy: { slug: "asc" },
    })
  ).map((e) => e.id);
  const program = await prisma.userProgram.create({
    data: {
      userId: OWNER,
      name: "Publicar",
      status: "ACTIVE",
      daysPerWeek: 3,
      days: {
        create: [
          {
            dayIndex: 0,
            name: "Dia A",
            exercises: {
              create: [
                { exerciseId: exerciseIds[0], sortOrder: 0, sets: 3 },
                { exerciseId: exerciseIds[1], sortOrder: 1, sets: 3 },
              ],
            },
          },
        ],
      },
    },
    include: { days: true },
  });
  dayId = program.days[0].id;
  await prisma.programEnrollment.create({
    data: { userId: OWNER, programId: program.id, status: "ACTIVE", currentWeek: 1, nextDayIndex: 0, programSnapshot: {} },
  });
});

beforeEach(() => {
  currentUser = OWNER;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [OWNER, OTHER, REQUESTER] } } });
  await prisma.$disconnect();
});

describe("auto-publish on finish (W-048)", () => {
  it("a FOLLOWERS default: the workout opens with it and is published on finish, loads hidden, dated when finished", async () => {
    await setDefaults("FOLLOWERS", false);
    const first = await train(40);
    const second = await train(45);
    const session = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: second },
      select: { visibility: true, showDetailedLoads: true, finishedAt: true },
    });
    expect(session).toMatchObject({ visibility: "FOLLOWERS", showDetailedLoads: false });
    const rows = await prisma.activity.findMany({ where: { sessionId: { in: [first, second] } }, orderBy: { createdAt: "asc" } });
    expect(rows).toHaveLength(2);
    const activity = rows[1];
    expect(activity).toMatchObject({ type: "WORKOUT", visibility: "FOLLOWERS", showDetailedLoads: false, caption: null });
    expect(activity.createdAt.getTime()).toBe(session.finishedAt!.getTime());
    const summary = activity.summary as { totalVolumeKg: unknown; exercises: { bestSet: unknown }[]; prs: { exerciseName: string; value: unknown }[] };
    expect(summary.totalVolumeKg).toBeNull();
    expect(summary.exercises.every((e) => e.bestSet === null)).toBe(true);
    // The heavier second workout holds a load record: its name, never its load.
    expect(summary.prs.length).toBeGreaterThan(0);
    expect(summary.prs.every((p) => typeof p.exerciseName === "string")).toBe(true);
    // A share link is never minted on finish.
    expect(await tokenOf(second)).toBeNull();
  });

  it("a PRIVATE default publishes nothing", async () => {
    await setDefaults("PRIVATE");
    const sessionId = await train(40);
    expect(await prisma.activity.count({ where: { sessionId } })).toBe(0);
    expect((await prisma.workoutSession.findUniqueOrThrow({ where: { id: sessionId } })).visibility).toBe("PRIVATE");
  });

  it("the profile's loads flag rides along", async () => {
    await setDefaults("PUBLIC", true);
    const sessionId = await train(40);
    const activity = await prisma.activity.findUniqueOrThrow({ where: { sessionId } });
    expect(activity).toMatchObject({ visibility: "PUBLIC", showDetailedLoads: true });
    expect((activity.summary as { totalVolumeKg: number }).totalVolumeKg).toBeGreaterThan(0);
  });

  it("publishing twice (a retry, a race with a tap) leaves one row; a late save keeps its own date", async () => {
    await setDefaults("PRIVATE");
    const sessionId = await train(40);
    await prisma.workoutSession.update({ where: { id: sessionId }, data: { visibility: "FOLLOWERS" } });
    const finishedAt = new Date(Date.now() - 3 * 86_400_000);
    const [a, b] = await Promise.all([publishOnFinish(OWNER, sessionId, finishedAt), publishOnFinish(OWNER, sessionId, finishedAt)]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    const rows = await prisma.activity.findMany({ where: { sessionId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].createdAt.getTime()).toBe(finishedAt.getTime());
    // A manual share after it updates the same row.
    const shared = await activities.shareWorkoutSession({ sessionId, visibility: "PUBLIC", showDetailedLoads: false });
    expect(shared).toMatchObject({ ok: true, activityId: rows[0].id, visibility: "PUBLIC" });
    expect(await prisma.activity.count({ where: { sessionId } })).toBe(1);
  });

  it("someone else's session publishes nothing", async () => {
    await setDefaults("FOLLOWERS");
    const sessionId = await startWorkout();
    expect(await publishOnFinish(OTHER, sessionId, new Date())).toBeNull();
    // Unfinished: nothing either.
    expect(await publishOnFinish(OWNER, sessionId, new Date())).toBeNull();
    await workouts.discardWorkoutSession(sessionId).catch(() => {});
  });
});

describe("share links (W-008)", () => {
  it("a PRIVATE workout gets a PRIVATE activity and one token, whatever the number of taps", async () => {
    await setDefaults("PRIVATE");
    const sessionId = await train(40);
    const results = await Promise.all(
      Array.from({ length: 4 }, () => activities.ensureWorkoutShareLink({ sessionId, showDetailedLoads: false })),
    );
    const tokens = new Set(results.map((r) => (r.ok ? r.token : r.error)));
    expect(tokens.size).toBe(1);
    const [token] = tokens;
    expect(token).toMatch(/^[A-Za-z0-9_-]{16}$/);
    const activity = await prisma.activity.findUniqueOrThrow({ where: { sessionId }, select: { visibility: true, shareToken: true, sharedAt: true } });
    expect(activity).toMatchObject({ visibility: "PRIVATE", shareToken: token });
    expect(activity.sharedAt).toBeInstanceOf(Date);
    // The token never rides along in ordinary reads (lib/db.ts omit).
    const plain = await prisma.activity.findUniqueOrThrow({ where: { sessionId } });
    expect("shareToken" in plain && plain.shareToken !== undefined).toBe(false);
  });

  it("the link shows the loads as chosen on screen, and the card is rebuilt", async () => {
    await setDefaults("PRIVATE");
    const sessionId = await train(50);
    const hidden = await activities.ensureWorkoutShareLink({ sessionId, showDetailedLoads: false, caption: "  Pesado hoje  " });
    expect(hidden.ok).toBe(true);
    if (!hidden.ok) return;
    let shared = await getSharedWorkout(hidden.token);
    expect(shared?.view.loadsShown).toBe(false);
    expect(shared?.view.totalVolumeKg).toBeNull();
    expect(shared?.activity.caption).toBe("Pesado hoje");
    expect(JSON.stringify(shared?.view)).not.toMatch(/kg/);

    const shown = await activities.ensureWorkoutShareLink({ sessionId, showDetailedLoads: true });
    expect(shown).toMatchObject({ ok: true, token: hidden.token, showDetailedLoads: true, caption: "Pesado hoje" });
    shared = await getSharedWorkout(hidden.token);
    expect(shared?.view.loadsShown).toBe(true);
    expect(shared?.view.exercises[0].bestSet).toEqual({ weightKg: 50, reps: 10 });
    // The session keeps its correction window: sharing isn't an edit.
    const s = await prisma.workoutSession.findUniqueOrThrow({ where: { id: sessionId }, select: { updatedAt: true, finishedAt: true } });
    expect(s.updatedAt.getTime() - s.finishedAt!.getTime()).toBeLessThan(5_000);
  });

  it("revoking kills the link; a new share mints a new one", async () => {
    await setDefaults("PRIVATE");
    const sessionId = await train(40);
    const first = await activities.ensureWorkoutShareLink({ sessionId, showDetailedLoads: false });
    if (!first.ok) throw new Error(first.error);
    expect(await getSharedWorkout(first.token)).not.toBeNull();
    expect(await activities.revokeWorkoutShareLink(sessionId)).toEqual({ ok: true });
    expect(await tokenOf(sessionId)).toBeNull();
    expect(await getSharedWorkout(first.token)).toBeNull();
    const second = await activities.ensureWorkoutShareLink({ sessionId, showDetailedLoads: false });
    expect(second.ok && second.token !== first.token).toBe(true);
  });

  it("refuses someone else's workout, an unfinished one, a moderated one and an expired session", async () => {
    await setDefaults("PRIVATE");
    const sessionId = await train(40);
    currentUser = OTHER;
    expect((await activities.ensureWorkoutShareLink({ sessionId, showDetailedLoads: false })).ok).toBe(false);
    expect((await activities.shareWorkoutSession({ sessionId, visibility: "PUBLIC", showDetailedLoads: true })).ok).toBe(false);
    // Revoking another's link changes nothing.
    currentUser = OWNER;
    const mine = await activities.ensureWorkoutShareLink({ sessionId, showDetailedLoads: false });
    currentUser = OTHER;
    await activities.revokeWorkoutShareLink(sessionId);
    expect(await tokenOf(sessionId)).toBe(mine.ok ? mine.token : "x");

    currentUser = OWNER;
    const open = await startWorkout();
    expect(await activities.ensureWorkoutShareLink({ sessionId: open, showDetailedLoads: false })).toEqual({
      ok: false,
      error: "Este treino ainda não foi salvo.",
    });
    await workouts.discardWorkoutSession(open).catch(() => {});

    await prisma.activity.update({ where: { sessionId }, data: { moderatedAt: new Date(), shareToken: null, visibility: "PRIVATE" } });
    const moderated = "Esta publicação foi ocultada pela moderação.";
    expect(await activities.ensureWorkoutShareLink({ sessionId, showDetailedLoads: false })).toEqual({ ok: false, error: moderated });
    expect(await activities.shareWorkoutSession({ sessionId, visibility: "PUBLIC", showDetailedLoads: false })).toEqual({
      ok: false,
      error: moderated,
    });

    currentUser = null;
    expect(await activities.ensureWorkoutShareLink({ sessionId, showDetailedLoads: false })).toEqual({ ok: false, error: SESSION_EXPIRED_ERROR });
    expect(await activities.revokeWorkoutShareLink(sessionId)).toEqual({ ok: false, error: SESSION_EXPIRED_ERROR });
  });

  it("getSharedWorkout: nothing for a malformed token, a banned author or a non-workout", async () => {
    await setDefaults("PRIVATE");
    const sessionId = await train(40);
    const link = await activities.ensureWorkoutShareLink({ sessionId, showDetailedLoads: false });
    if (!link.ok) throw new Error(link.error);
    expect(await getSharedWorkout("not-a-token")).toBeNull();
    expect(await getSharedWorkout(`${link.token}x`)).toBeNull();
    const shared = await getSharedWorkout(link.token);
    expect(shared?.author).toMatchObject({ id: OWNER, name: "Dona" });
    expect(shared?.ordinal).toBeGreaterThan(0);

    await prisma.user.update({ where: { id: OWNER }, data: { banned: true } });
    expect(await getSharedWorkout(link.token)).toBeNull();
    await prisma.user.update({ where: { id: OWNER }, data: { banned: false } });

    const stamp = await prisma.activity.create({
      data: { userId: OWNER, type: "MILESTONE", visibility: "PRIVATE", summary: {}, shareToken: `${RUN_ID}`.slice(-16).padStart(16, "M") },
      select: { id: true, shareToken: true },
    });
    expect(await getSharedWorkout(stamp.shareToken!)).toBeNull();
    await prisma.activity.delete({ where: { id: stamp.id } });
  });
});

describe("an admin's hide wins a race with the owner's share", () => {
  const moderated = { ok: false, error: "Esta publicação foi ocultada pela moderação." };
  const card = { workoutName: "Push A", totalWorkingSets: 0, prs: [], exercises: [] };

  async function finishedWorkout(visibility: "PRIVATE" | "FOLLOWERS") {
    const at = new Date(Date.now() - 3_600_000);
    return prisma.workoutSession.create({
      data: { userId: OWNER, name: "Push A", status: "COMPLETED", startedAt: at, finishedAt: at, visibility },
    });
  }

  /** What "Ocultar treino" writes (lib/actions/admin.ts, HIDE). */
  async function hide(sessionId: string) {
    await prisma.$transaction([
      prisma.activity.update({
        where: { sessionId },
        data: { visibility: "PRIVATE", shareToken: null, sharedAt: null, moderatedAt: new Date() },
      }),
      prisma.workoutSession.update({ where: { id: sessionId }, data: { visibility: "PRIVATE" } }),
    ]);
  }

  /** Runs `meanwhile` between upsertWorkoutActivity's read of the workout and its write. */
  function afterTheRead(meanwhile: () => Promise<unknown>) {
    const read = prisma.workoutSession.findFirst.bind(prisma.workoutSession);
    return vi.spyOn(prisma.workoutSession, "findFirst").mockImplementationOnce((async (args: Parameters<typeof read>[0]) => {
      const row = await read(args);
      await meanwhile();
      return row;
    }) as never);
  }

  async function expectStillHidden(sessionId: string) {
    const activity = await prisma.activity.findUniqueOrThrow({ where: { sessionId } });
    expect(activity).toMatchObject({ visibility: "PRIVATE", showDetailedLoads: false, caption: null });
    expect(activity.moderatedAt).toBeInstanceOf(Date);
    // The workout stays as moderation left it too.
    expect((await prisma.workoutSession.findUniqueOrThrow({ where: { id: sessionId } })).visibility).toBe("PRIVATE");
  }

  it("a hide landing after the read isn't published again", async () => {
    const session = await finishedWorkout("FOLLOWERS");
    await prisma.activity.create({ data: { userId: OWNER, type: "WORKOUT", sessionId: session.id, visibility: "FOLLOWERS", summary: card } });
    const spy = afterTheRead(() => hide(session.id));
    try {
      const result = await activities.shareWorkoutSession({ sessionId: session.id, visibility: "PUBLIC", showDetailedLoads: true, caption: "Olhem" });
      expect(spy).toHaveBeenCalled();
      expect(result).toEqual(moderated);
    } finally {
      spy.mockRestore();
    }
    await expectStillHidden(session.id);
  });

  it("nor when another writer created the post, hidden since, before this share's own create", async () => {
    const session = await finishedWorkout("PRIVATE");
    const spy = afterTheRead(async () => {
      await prisma.activity.create({ data: { userId: OWNER, type: "WORKOUT", sessionId: session.id, visibility: "FOLLOWERS", summary: card } });
      await hide(session.id);
    });
    try {
      const result = await activities.shareWorkoutSession({ sessionId: session.id, visibility: "PUBLIC", showDetailedLoads: true, caption: "Olhem" });
      expect(spy).toHaveBeenCalled();
      expect(result).toEqual(moderated);
    } finally {
      spy.mockRestore();
    }
    await expectStillHidden(session.id);
  });
});

describe("D-A: the one-time question to a PRIVATE default", () => {
  it("'Mostrar aos seguidores' sets the default and publishes this workout to followers, loads as the profile says", async () => {
    await setDefaults("PRIVATE", false);
    const sessionId = await train(40);
    const result = await activities.showWorkoutsToFollowers(sessionId);
    expect(result).toMatchObject({ ok: true, visibility: "FOLLOWERS", showDetailedLoads: false });
    expect((await prisma.profile.findUniqueOrThrow({ where: { userId: OWNER } })).defaultWorkoutVisibility).toBe("FOLLOWERS");
    const activity = await prisma.activity.findUniqueOrThrow({ where: { sessionId } });
    const session = await prisma.workoutSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(activity.visibility).toBe("FOLLOWERS");
    expect(activity.createdAt.getTime()).toBe(session.finishedAt!.getTime());
  });

  it("'Manter privado' is remembered on the server; choosing Privado in Settings counts as an answer", async () => {
    await prisma.userDismissal.deleteMany({ where: { userId: OWNER } });
    expect(await profileActions.keepWorkoutsPrivate()).toEqual({ ok: true });
    expect(await prisma.userDismissal.count({ where: { userId: OWNER, key: "private-default-notice" } })).toBe(1);
    expect(await profileActions.keepWorkoutsPrivate()).toEqual({ ok: true });

    await prisma.userDismissal.deleteMany({ where: { userId: OWNER } });
    await setDefaults("FOLLOWERS");
    const base = { isPublicAccount: false, showLoadsPublicly: false, showCurrentProgram: true, discoverable: true };
    expect((await profileActions.updatePrivacySettings({ ...base, defaultWorkoutVisibility: "PRIVATE" })).ok).toBe(true);
    expect(await prisma.userDismissal.count({ where: { userId: OWNER, key: "private-default-notice" } })).toBe(1);
  });
});

describe("privacy settings (W-048, W-044)", () => {
  const base = { showLoadsPublicly: false, showCurrentProgram: true, discoverable: true, defaultWorkoutVisibility: "FOLLOWERS" as const };

  it("refuses the removed switches (strict schema)", async () => {
    const withOld = { ...base, isPublicAccount: false, autoShareAchievements: true };
    expect((await profileActions.updatePrivacySettings(withOld as never)).ok).toBe(false);
    const withBody = { ...base, isPublicAccount: false, showBodyMetricsPublicly: true };
    expect((await profileActions.updatePrivacySettings(withBody as never)).ok).toBe(false);
  });

  it("going public accepts every pending request, with one FOLLOW_ACCEPTED each", async () => {
    await prisma.profile.update({ where: { userId: OWNER }, data: { isPublicAccount: false } });
    await prisma.followRequest.create({ data: { requesterId: REQUESTER, targetId: OWNER } });
    await prisma.followRequest.create({ data: { requesterId: OTHER, targetId: OWNER, status: "DECLINED" } });

    expect((await profileActions.updatePrivacySettings({ ...base, isPublicAccount: true })).ok).toBe(true);
    expect(await prisma.follow.count({ where: { followerId: REQUESTER, followingId: OWNER } })).toBe(1);
    // A declined request stays declined.
    expect(await prisma.follow.count({ where: { followerId: OTHER, followingId: OWNER } })).toBe(0);
    const request = await prisma.followRequest.findUniqueOrThrow({ where: { requesterId_targetId: { requesterId: REQUESTER, targetId: OWNER } } });
    expect(request.status).toBe("ACCEPTED");
    expect(request.respondedAt).toBeInstanceOf(Date);
    const notes = await prisma.notification.findMany({ where: { recipientId: REQUESTER, type: "FOLLOW_ACCEPTED" } });
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ actorId: OWNER, dedupeKey: `accepted:${OWNER}`, readAt: null });

    // Saving again (still public) accepts nothing new and notifies no one again.
    expect((await profileActions.updatePrivacySettings({ ...base, isPublicAccount: true, discoverable: false })).ok).toBe(true);
    expect(await prisma.notification.count({ where: { recipientId: REQUESTER, type: "FOLLOW_ACCEPTED" } })).toBe(1);
    // Public → private keeps the followers.
    expect((await profileActions.updatePrivacySettings({ ...base, isPublicAccount: false })).ok).toBe(true);
    expect(await prisma.follow.count({ where: { followingId: OWNER } })).toBe(1);
  });

  it("an expired session saves nothing", async () => {
    currentUser = null;
    expect(await profileActions.updatePrivacySettings({ ...base, isPublicAccount: true })).toEqual({ ok: false, error: SESSION_EXPIRED_ERROR });
    expect(await profileActions.keepWorkoutsPrivate()).toEqual({ ok: false, error: SESSION_EXPIRED_ERROR });
  });
});
