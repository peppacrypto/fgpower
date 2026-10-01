import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { SESSION_EXPIRED_ERROR } from "@/lib/auth/session-expired";
import { dayNumberOf, mondayOf } from "@/lib/training/day-rotation";
import { startOfWeek } from "@/lib/training/week";
import { getPreviousPerformances, getSessionRirTargets, getWorkoutWeek } from "@/lib/data/workout-session";

/**
 * "Aplicar deload" (W-128, decision 16) against the real local Postgres: the
 * program's rule must call for it (2+ triggers) this week, it can't come
 * within 4 weeks of another, and it's the user's own active program. It only
 * marks the week: the workouts started after it open with half the working
 * sets and as deload workouts (RIR raised, never a load reference for a
 * normal one); workouts already open keep theirs. "Desfazer" works until a
 * workout starts under it.
 */

const RUN_ID = `deload-${Date.now()}`;
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

const deload = await import("./deload");
const workouts = await import("./workouts");

const DAY_MS = 86_400_000;
const NOW = new Date();
const WEEK_KEY = String(mondayOf(dayNumberOf(NOW)));
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY_MS);

let enrollmentId: string;
let otherEnrollmentId: string;
let programId: string;
let dayA: string;
let dayB: string;
let ex: string[];

async function redirectOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (err) {
    if (err instanceof Redirected) return err.url;
    throw err;
  }
  throw new Error("expected a redirect");
}
async function start(dayId: string) {
  const url = await redirectOf(workouts.startAdHocWorkoutSession(dayId));
  return url.split("/")[3].split("?")[0];
}

/** A finished workout of the block: `sets` of the given exercises at (kg, reps), maybe with a check-in. */
async function finished(p: { at: Date; programWeek: number; lifts: { exerciseId: string; kg: number; reps: number }[]; shortSleep?: boolean }) {
  const s = await prisma.workoutSession.create({
    data: {
      userId: USER_ID,
      enrollmentId,
      programId,
      programDayId: dayA,
      name: "Dia A",
      status: "COMPLETED",
      startedAt: new Date(p.at.getTime() - 3_600_000),
      finishedAt: p.at,
      updatedAt: p.at,
      programWeek: p.programWeek,
      totalWorkingSets: Math.max(1, p.lifts.length * 3),
      ...(p.shortSleep ? { shortSleep: true, checkInAt: p.at } : {}),
    },
  });
  for (const [i, lift] of p.lifts.entries()) {
    const log = await prisma.workoutExerciseLog.create({
      data: { sessionId: s.id, userId: USER_ID, exerciseId: lift.exerciseId, sortOrder: i, prescribedSets: 3, repMin: 6, repMax: 10, restSeconds: 90 },
    });
    for (let n = 1; n <= 3; n++) {
      await prisma.setLog.create({
        data: {
          userId: USER_ID,
          sessionId: s.id,
          exerciseLogId: log.id,
          exerciseId: lift.exerciseId,
          setNumber: n,
          setType: "WORKING",
          weightKg: lift.kg,
          reps: lift.reps,
          isCompleted: true,
          completedAt: p.at,
        },
      });
    }
  }
  return s.id;
}

async function mondays() {
  return (await prisma.programEnrollment.findUniqueOrThrow({ where: { id: enrollmentId } })).deloadMondays;
}

beforeAll(async () => {
  for (const id of [USER_ID, OTHER_ID]) {
    await prisma.user.create({ data: { id, name: id, email: `${id}@fgpower.test`, emailVerified: true } });
    await prisma.profile.create({ data: { userId: id, displayName: "Teste", onboardingCompletedAt: new Date(), daysPerWeek: 4 } });
  }
  ex = (
    await prisma.exercise.findMany({
      where: { slug: { in: ["barbell-bench-press-medium-grip", "barbell-squat", "leg-extensions", "wide-grip-lat-pulldown"] } },
      orderBy: { slug: "asc" },
      select: { id: true },
    })
  ).map((e) => e.id);
  expect(ex).toHaveLength(4);
  const program = await prisma.userProgram.create({
    data: {
      userId: USER_ID,
      name: "Força",
      status: "ACTIVE",
      daysPerWeek: 4,
      days: {
        create: [
          {
            dayIndex: 0,
            name: "Dia A",
            exercises: {
              create: [
                { exerciseId: ex[0], sortOrder: 0, sets: 4, rirTarget: 2, notes: "Âncora do dia." },
                { exerciseId: ex[2], sortOrder: 1, sets: 3, rirTarget: 2 },
              ],
            },
          },
          {
            dayIndex: 1,
            name: "Dia B",
            exercises: {
              create: [
                { exerciseId: ex[1], sortOrder: 0, sets: 4, rirTarget: 2, notes: "Benchmark (teste no fim)." },
                { exerciseId: ex[3], sortOrder: 1, sets: 2, rirTarget: 2 },
              ],
            },
          },
        ],
      },
    },
    include: { days: { orderBy: { dayIndex: "asc" } } },
  });
  programId = program.id;
  [dayA, dayB] = program.days.map((d) => d.id);
  // Started on a Monday six weeks back (no entry week), now in its sixth week.
  const enrollment = await prisma.programEnrollment.create({
    data: {
      userId: USER_ID,
      programId,
      status: "ACTIVE",
      currentWeek: 6,
      startedAt: new Date(startOfWeek(NOW).getTime() - 6 * 7 * DAY_MS + 12 * 3_600_000),
      programSnapshot: {},
    },
  });
  enrollmentId = enrollment.id;
  const theirs = await prisma.userProgram.create({ data: { userId: OTHER_ID, name: "Deles", status: "ACTIVE", daysPerWeek: 3 } });
  otherEnrollmentId = (
    await prisma.programEnrollment.create({
      data: { userId: OTHER_ID, programId: theirs.id, status: "ACTIVE", currentWeek: 6, programSnapshot: {} },
    })
  ).id;

  // Both key exercises: 10 → 8 → 8 reps at the same load over the last two weeks.
  for (const [n, reps, week] of [
    [13, 10, 4],
    [6, 8, 5],
    [2, 8, 6],
  ] as const) {
    await finished({
      at: daysAgo(n),
      programWeek: week,
      lifts: [
        { exerciseId: ex[0], kg: 60, reps },
        { exerciseId: ex[1], kg: 100, reps },
      ],
    });
  }
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [USER_ID, OTHER_ID] } } });
  await prisma.$disconnect();
});

describe("applyDeload / undoDeload", () => {
  it("refuses without 2 triggers (reps alone only asks to watch), a stale week, someone else's program, a signed-out caller", async () => {
    expect(await deload.applyDeload(enrollmentId, WEEK_KEY)).toMatchObject({ ok: false, error: expect.stringContaining("sinal") });
    expect(await deload.applyDeload(enrollmentId, String(Number(WEEK_KEY) - 7))).toMatchObject({
      ok: false,
      error: expect.stringContaining("semana passada"),
    });
    expect(await deload.applyDeload(otherEnrollmentId, WEEK_KEY)).toMatchObject({ ok: false });
    signedIn = null;
    expect(await deload.applyDeload(enrollmentId, WEEK_KEY)).toEqual({ ok: false, error: SESSION_EXPIRED_ERROR });
    expect(await deload.undoDeload(enrollmentId, WEEK_KEY)).toEqual({ ok: false, error: SESSION_EXPIRED_ERROR });
    signedIn = USER_ID;
    expect(await mondays()).toEqual([]);
  });

  it("with a second trigger (short sleep in 3 check-ins), applies once — and undoes before any workout", async () => {
    for (const n of [6.5, 4, 1]) await finished({ at: daysAgo(n), programWeek: 6, lifts: [], shortSleep: true });
    expect(await deload.applyDeload(enrollmentId, WEEK_KEY)).toEqual({ ok: true });
    expect(await deload.applyDeload(enrollmentId, WEEK_KEY)).toEqual({ ok: true });
    expect(await mondays()).toEqual([Number(WEEK_KEY)]);
    expect(await deload.undoDeload(enrollmentId, WEEK_KEY)).toEqual({ ok: true });
    expect(await mondays()).toEqual([]);
  });

  it("a workout already open keeps its sets; the next ones open halved, as deload workouts", async () => {
    const open = await start(dayA);
    expect(await deload.applyDeload(enrollmentId, WEEK_KEY)).toEqual({ ok: true });
    // Same day again: the open one, as it was.
    expect(await start(dayA)).toBe(open);
    const kept = await prisma.workoutExerciseLog.findMany({ where: { sessionId: open }, orderBy: { sortOrder: "asc" } });
    expect(kept.map((l) => l.prescribedSets)).toEqual([4, 3]);
    await workouts.discardWorkoutSession(open);

    const light = await start(dayB);
    const session = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: light },
      include: { exerciseLogs: { orderBy: { sortOrder: "asc" }, include: { sets: true } } },
    });
    expect(session.isDeload).toBe(true);
    expect(session.exerciseLogs.map((l) => l.prescribedSets)).toEqual([2, 1]);
    expect(session.exerciseLogs.map((l) => l.sets.filter((s) => s.setType === "WORKING").length)).toEqual([2, 1]);
    // The workout screen's week reads as the applied deload, even without program guidance.
    expect((await getWorkoutWeek(USER_ID, light))?.guidance).toMatchObject({ deload: true, applied: true, rirTarget: 3.5 });

    // Started under it: the deload stays.
    expect(await deload.undoDeload(enrollmentId, WEEK_KEY)).toMatchObject({ ok: false, error: expect.stringContaining("já começou") });

    // Finished: RIR raised (no wave: at least 3), and never the reference for a normal workout.
    const squat = session.exerciseLogs[0];
    const set = squat.sets.find((s) => s.setType === "WORKING")!;
    expect(await workouts.logSet({ setLogId: set.id, weightKg: 80, reps: 5, rir: 3 })).toEqual({ ok: true });
    await redirectOf(workouts.finishWorkoutSession(light));
    expect((await getSessionRirTargets(USER_ID, light)).get(squat.id)).toBe(3);

    // Next week (the deload gone): a normal workout's last time is the one before the deload.
    await prisma.programEnrollment.update({ where: { id: enrollmentId }, data: { deloadMondays: [] } });
    const normal = await start(dayB);
    expect((await prisma.workoutSession.findUniqueOrThrow({ where: { id: normal } })).isDeload).toBe(false);
    const previous = await getPreviousPerformances(USER_ID, normal);
    expect(previous.get(squat.exerciseId)?.sets[0]).toMatchObject({ weightKg: 100, reps: 8 });
    await workouts.discardWorkoutSession(normal);
  });

  it("never within 4 weeks of another applied deload", async () => {
    await prisma.programEnrollment.update({ where: { id: enrollmentId }, data: { deloadMondays: [Number(WEEK_KEY) - 14] } });
    expect(await deload.applyDeload(enrollmentId, WEEK_KEY)).toMatchObject({ ok: false });
    expect(await mondays()).toEqual([Number(WEEK_KEY) - 14]);
  });
});

describe("dismissFatigueSignal", () => {
  it("closes this week's signal for the user (idempotent)", async () => {
    expect(await deload.dismissFatigueSignal(enrollmentId, WEEK_KEY)).toEqual({ ok: true });
    expect(await deload.dismissFatigueSignal(enrollmentId, WEEK_KEY)).toEqual({ ok: true });
    expect(await prisma.userDismissal.count({ where: { userId: USER_ID, key: `fatigue:${enrollmentId}:${WEEK_KEY}` } })).toBe(1);
    expect(await deload.dismissFatigueSignal("../x", WEEK_KEY)).toMatchObject({ ok: false });
  });

  it("closes nothing but this week's signal of the user's own program", async () => {
    const before = await prisma.userDismissal.count({ where: { userId: USER_ID } });
    // Another user's program, a program that doesn't exist, last week's or a made-up week key.
    expect(await deload.dismissFatigueSignal(otherEnrollmentId, WEEK_KEY)).toMatchObject({ ok: false });
    expect(await deload.dismissFatigueSignal(`${RUN_ID}-nope`, WEEK_KEY)).toMatchObject({ ok: false });
    expect(await deload.dismissFatigueSignal(enrollmentId, String(Number(WEEK_KEY) - 7))).toMatchObject({ ok: false });
    expect(await deload.dismissFatigueSignal(enrollmentId, "999999")).toMatchObject({ ok: false });
    expect(await prisma.userDismissal.count({ where: { userId: USER_ID } })).toBe(before);
    // Signed out: the session-expired result (D-L).
    signedIn = null;
    try {
      expect(await deload.dismissFatigueSignal(enrollmentId, WEEK_KEY)).toEqual({ ok: false, error: SESSION_EXPIRED_ERROR });
    } finally {
      signedIn = USER_ID;
    }
  });
});
