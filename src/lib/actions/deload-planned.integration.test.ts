import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { startOfWeek } from "@/lib/training/week";
import { getPreviousPerformances } from "@/lib/data/workout-session";

const RUN_ID = `deload-planned-${Date.now()}`;
const USER_ID = `${RUN_ID}-u`;
const signedIn: string | null = USER_ID;

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

const workouts = await import("./workouts");

const DAY_MS = 86_400_000;
const NOW = new Date();
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY_MS);

let enrollmentId: string;
let programId: string;
let dayId: string;
let squatId: string;

async function redirectOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (err) {
    if (err instanceof Redirected) return err.url;
    throw err;
  }
  throw new Error("expected a redirect");
}
async function start() {
  const url = await redirectOf(workouts.startAdHocWorkoutSession(dayId));
  return url.split("/")[3].split("?")[0];
}

/** A finished squat session at (kg, reps), written straight to the DB in the given week. */
async function finished(p: { at: Date; programWeek: number; kg: number; reps: number }) {
  const s = await prisma.workoutSession.create({
    data: {
      userId: USER_ID,
      enrollmentId,
      programId,
      programDayId: dayId,
      name: "Dia A",
      status: "COMPLETED",
      startedAt: new Date(p.at.getTime() - 3_600_000),
      finishedAt: p.at,
      updatedAt: p.at,
      programWeek: p.programWeek,
      totalWorkingSets: 3,
    },
  });
  const log = await prisma.workoutExerciseLog.create({
    data: { sessionId: s.id, userId: USER_ID, exerciseId: squatId, sortOrder: 0, prescribedSets: 3, repMin: 5, repMax: 8, restSeconds: 120 },
  });
  for (let n = 1; n <= 3; n++) {
    await prisma.setLog.create({
      data: { userId: USER_ID, sessionId: s.id, exerciseLogId: log.id, exerciseId: squatId, setNumber: n, setType: "WORKING", weightKg: p.kg, reps: p.reps, isCompleted: true, completedAt: p.at },
    });
  }
  return s.id;
}

beforeAll(async () => {
  await prisma.user.create({ data: { id: USER_ID, name: USER_ID, email: `${USER_ID}@fgpower.test`, emailVerified: true } });
  await prisma.profile.create({ data: { userId: USER_ID, displayName: "Teste", onboardingCompletedAt: new Date(), daysPerWeek: 3 } });
  squatId = (await prisma.exercise.findFirstOrThrow({ where: { slug: "barbell-squat" }, select: { id: true } })).id;

  const program = await prisma.userProgram.create({
    data: {
      userId: USER_ID,
      name: "Força com deload",
      status: "ACTIVE",
      daysPerWeek: 3,
      durationWeeks: 8,
      // Week 6 is a PLANNED deload (not applied): a statement, not a condition.
      weeklyGuidance: [
        { week: 5, rirTarget: 2, notePt: "", setsNotePt: "" },
        { week: 6, rirTarget: 3, notePt: "", setsNotePt: "Deload: metade das séries, mesmas cargas." },
        { week: 7, rirTarget: 2, notePt: "", setsNotePt: "" },
      ],
      days: { create: [{ dayIndex: 0, name: "Dia A", exercises: { create: [{ exerciseId: squatId, sortOrder: 0, sets: 3, repMin: 5, repMax: 8, rirTarget: 2, restSeconds: 120 }] } }] },
    },
    include: { days: true },
  });
  programId = program.id;
  dayId = program.days[0].id;
  // Started on a Monday six weeks ago (no entry week); in week 6 now.
  enrollmentId = (
    await prisma.programEnrollment.create({
      data: { userId: USER_ID, programId, status: "ACTIVE", currentWeek: 6, startedAt: new Date(startOfWeek(NOW).getTime() - 6 * 7 * DAY_MS + 12 * 3_600_000), programSnapshot: {} },
    })
  ).id;

  // Pre-deload squat at 100 kg (week 5), earlier this block, plus one this calendar week
  // so advanceProgram keeps a workout finished now in week 6.
  await finished({ at: daysAgo(9), programWeek: 5, kg: 100, reps: 8 });
  await finished({ at: daysAgo(1), programWeek: 6, kg: 100, reps: 8 });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: USER_ID } });
  await prisma.$disconnect();
});

describe("a planned deload week is one deload signal (A-017)", () => {
  it("finishing in a planned deload week stamps isDeload — without the user applying one", async () => {
    const deloadSession = await start();
    const squatLog = await prisma.workoutExerciseLog.findFirstOrThrow({ where: { sessionId: deloadSession, exerciseId: squatId } });
    const set = await prisma.setLog.findFirstOrThrow({ where: { exerciseLogId: squatLog.id, setType: "WORKING" }, orderBy: { setNumber: "asc" } });
    // The deload week itself: lifted 80 kg (reduced), as a deload workout would.
    expect(await workouts.logSet({ setLogId: set.id, weightKg: 80, reps: 5, rir: 3 })).toEqual({ ok: true });
    await redirectOf(workouts.finishWorkoutSession(deloadSession));

    const saved = await prisma.workoutSession.findUniqueOrThrow({ where: { id: deloadSession } });
    expect(saved.isDeload).toBe(true); // planned deload, no deloadMondays entry
    expect(await prisma.programEnrollment.findUniqueOrThrow({ where: { id: enrollmentId } }).then((e) => e.deloadMondays)).toEqual([]);

    // A normal session afterwards takes the PRE-deload 100 kg as its reference, never the 80 kg.
    const normal = await start();
    const normalSquat = await prisma.workoutExerciseLog.findFirstOrThrow({ where: { sessionId: normal, exerciseId: squatId }, orderBy: { sortOrder: "asc" } });
    const previous = await getPreviousPerformances(USER_ID, normal);
    expect(previous.get(normalSquat.id)?.sets[0]).toMatchObject({ weightKg: 100 });
    await workouts.discardWorkoutSession(normal);
  });
});
