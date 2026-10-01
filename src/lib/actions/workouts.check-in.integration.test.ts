import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { SESSION_EXPIRED_ERROR } from "@/lib/auth/session-expired";
import { dayNumberOf } from "@/lib/training/day-rotation";
import { buildWorkoutActivitySummary } from "@/lib/social/activity-summary";
import { correctableUntil } from "@/lib/data/workout-session";

/**
 * The post-workout check-in (W-127) against the real local Postgres: it saves
 * every answer without moving the 24 h correction window, its weight is the
 * day's weigh-in on Corpo (and only the one it wrote goes when cleared), it
 * closes with the window, only for the user's own finished workout, and none
 * of it ever reaches a shared card.
 */

const RUN_ID = `checkin-${Date.now()}`;
const USER_ID = `${RUN_ID}-u`;
const OTHER_ID = `${RUN_ID}-o`;
let signedIn: string | null = USER_ID;

vi.mock("@/lib/auth/require-user", () => ({
  requireUserOrThrow: async () => {
    if (!signedIn) throw new Error("UNAUTHORIZED");
    return { id: signedIn };
  },
  getCurrentSession: async () => (signedIn ? { user: { id: signedIn } } : null),
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

const actions = await import("./workouts");

async function redirectOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (err) {
    if (err instanceof Redirected) return err.url;
    throw err;
  }
  throw new Error("expected a redirect");
}

let dayId: string;
const blank = {
  sessionRpe: null,
  soreness: null,
  shortSleep: false,
  lingeringPain: false,
  highStress: false,
  bodyweightKg: null,
  notes: null,
};

/** Starts the day, ✓'s one set and finishes it. */
async function finishedWorkout() {
  const url = await redirectOf(actions.startAdHocWorkoutSession(dayId));
  const sessionId = url.split("/")[3].split("?")[0];
  const set = await prisma.setLog.findFirstOrThrow({ where: { sessionId, setType: "WORKING" }, orderBy: { setNumber: "asc" } });
  expect(await actions.logSet({ setLogId: set.id, weightKg: 60, reps: 8, rir: null })).toEqual({ ok: true });
  await redirectOf(actions.finishWorkoutSession(sessionId));
  return sessionId;
}

beforeAll(async () => {
  for (const id of [USER_ID, OTHER_ID]) {
    await prisma.user.create({ data: { id, name: id, email: `${id}@fgpower.test`, emailVerified: true } });
    await prisma.profile.create({ data: { userId: id, displayName: "Teste", onboardingCompletedAt: new Date() } });
  }
  const bench = await prisma.exercise.findUniqueOrThrow({ where: { slug: "barbell-bench-press-medium-grip" } });
  const program = await prisma.userProgram.create({
    data: {
      userId: USER_ID,
      name: "Check-in",
      status: "ACTIVE",
      daysPerWeek: 3,
      days: { create: [{ dayIndex: 0, name: "Dia A", exercises: { create: [{ exerciseId: bench.id, sortOrder: 0, sets: 3 }] } }] },
    },
    include: { days: true },
  });
  dayId = program.days[0].id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [USER_ID, OTHER_ID] } } });
  await prisma.$disconnect();
});

describe("saveCheckIn", () => {
  it("saves every answer and keeps the workout's updatedAt: the 24 h window never moves", async () => {
    const sessionId = await finishedWorkout();
    const before = await prisma.workoutSession.findUniqueOrThrow({ where: { id: sessionId } });
    const result = await actions.saveCheckIn(sessionId, {
      sessionRpe: 8,
      soreness: 3,
      shortSleep: true,
      lingeringPain: false,
      highStress: true,
      bodyweightKg: 81.44,
      notes: "  Ombro\u0007 pesado no supino.  ",
    });
    expect(result).toMatchObject({ ok: true });
    const after = await prisma.workoutSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(after).toMatchObject({
      sessionRpe: 8,
      soreness: 3,
      shortSleep: true,
      lingeringPain: false,
      highStress: true,
      bodyweightKg: 81.4,
      notes: "Ombro pesado no supino.",
    });
    expect(after.checkInAt).not.toBeNull();
    expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
    expect(correctableUntil(after as { finishedAt: Date; updatedAt: Date })).toEqual(
      correctableUntil(before as { finishedAt: Date; updatedAt: Date }),
    );
  });

  it("the weight is the day's weigh-in (tagged with the workout), replaces one typed by hand, and goes when cleared", async () => {
    const sessionId = await finishedWorkout();
    const s = await prisma.workoutSession.findUniqueOrThrow({ where: { id: sessionId }, select: { finishedAt: true } });
    const day = dayNumberOf(s.finishedAt!);
    // Typed on Corpo earlier the same day.
    await prisma.bodyMetric.deleteMany({ where: { userId: USER_ID, kind: "BODYWEIGHT", day } });
    await prisma.bodyMetric.create({ data: { userId: USER_ID, kind: "BODYWEIGHT", value: 80, day } });

    await actions.saveCheckIn(sessionId, { ...blank, bodyweightKg: 81.4 });
    const row = await prisma.bodyMetric.findUniqueOrThrow({ where: { userId_kind_day: { userId: USER_ID, kind: "BODYWEIGHT", day } } });
    expect(row).toMatchObject({ value: 81.4, unit: "kg", sessionId });
    expect(row.measuredAt.getTime()).toBe(s.finishedAt!.getTime());

    // Saving another answer never rewrites a weigh-in edited on Corpo since.
    await prisma.bodyMetric.update({ where: { id: row.id }, data: { value: 81, sessionId: null } });
    await actions.saveCheckIn(sessionId, { ...blank, sessionRpe: 7, bodyweightKg: 81.4 });
    expect((await prisma.bodyMetric.findUniqueOrThrow({ where: { id: row.id } })).value).toBe(81);

    // Cleared: only the weigh-in the check-in wrote goes.
    await actions.saveCheckIn(sessionId, { ...blank, bodyweightKg: 82 });
    expect(await prisma.bodyMetric.count({ where: { userId: USER_ID, day, sessionId } })).toBe(1);
    await actions.saveCheckIn(sessionId, { ...blank, bodyweightKg: null });
    expect(await prisma.bodyMetric.count({ where: { userId: USER_ID, kind: "BODYWEIGHT", day } })).toBe(0);
  });

  it("refuses values out of range and caps the note at 500 characters", async () => {
    const sessionId = await finishedWorkout();
    const invalid = { ok: false, error: "Confira os valores." };
    expect(await actions.saveCheckIn(sessionId, { ...blank, sessionRpe: 11 })).toEqual(invalid);
    expect(await actions.saveCheckIn(sessionId, { ...blank, sessionRpe: 0 })).toEqual(invalid);
    expect(await actions.saveCheckIn(sessionId, { ...blank, soreness: -1 })).toEqual(invalid);
    expect(await actions.saveCheckIn(sessionId, { ...blank, soreness: 2.5 })).toEqual(invalid);
    expect(await actions.saveCheckIn(sessionId, { ...blank, bodyweightKg: 400 })).toEqual(invalid);
    expect(await actions.saveCheckIn(sessionId, { ...blank, shortSleep: "yes" as never })).toEqual(invalid);
    expect(await actions.saveCheckIn(sessionId, { ...blank, notes: "x".repeat(800) })).toMatchObject({ ok: true });
    const s = await prisma.workoutSession.findUniqueOrThrow({ where: { id: sessionId }, select: { notes: true } });
    expect(s.notes).toHaveLength(500);
    expect(await actions.saveCheckIn(sessionId, { ...blank, notes: "   " })).toMatchObject({ ok: true });
    expect((await prisma.workoutSession.findUniqueOrThrow({ where: { id: sessionId } })).notes).toBeNull();
  });

  it("closes with the correction window; only the user's own finished workout; a signed-out caller is told so", async () => {
    const sessionId = await finishedWorkout();
    // Saved 25 h ago (raw SQL keeps updatedAt as written).
    await prisma.$executeRaw`
      UPDATE "WorkoutSession" SET "finishedAt" = now() - interval '25 hours', "updatedAt" = now() - interval '25 hours'
      WHERE id = ${sessionId}`;
    expect(await actions.saveCheckIn(sessionId, { ...blank, sessionRpe: 5 })).toEqual({
      ok: false,
      error: "O check-in fica aberto por 24 h depois do treino.",
    });

    const fresh = await finishedWorkout();
    signedIn = OTHER_ID;
    expect(await actions.saveCheckIn(fresh, { ...blank, sessionRpe: 5 })).toEqual({ ok: false, error: "Treino não encontrado." });
    signedIn = null;
    expect(await actions.saveCheckIn(fresh, { ...blank, sessionRpe: 5 })).toEqual({ ok: false, error: SESSION_EXPIRED_ERROR });
    signedIn = USER_ID;

    const url = await redirectOf(actions.startAdHocWorkoutSession(dayId));
    const open = url.split("/")[3].split("?")[0];
    expect(await actions.saveCheckIn(open, { ...blank, sessionRpe: 5 })).toEqual({ ok: false, error: "Treino não encontrado." });
    await actions.discardWorkoutSession(open);
  });

  it("never reaches a shared workout's card", async () => {
    const sessionId = await finishedWorkout();
    await actions.saveCheckIn(sessionId, {
      sessionRpe: 9,
      soreness: 7,
      shortSleep: true,
      lingeringPain: true,
      highStress: true,
      bodyweightKg: 77.7,
      notes: "Nota secreta do check-in",
    });
    const session = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: {
        exerciseLogs: { include: { exercise: true, sets: true }, orderBy: { sortOrder: "asc" } },
        records: { include: { exercise: true } },
      },
    });
    const card = JSON.stringify(buildWorkoutActivitySummary(session, true));
    for (const secret of ["Nota secreta", "77.7", "77,7", "sessionRpe", "soreness", "shortSleep", "lingeringPain", "highStress", "bodyweight", "notes"]) {
      expect(card, secret).not.toContain(secret);
    }
  });
});
