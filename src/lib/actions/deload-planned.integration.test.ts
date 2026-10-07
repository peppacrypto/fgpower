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
const WEEK_MS = 7 * DAY_MS;
const NOW = new Date();

// The enrollment is anchored so the CURRENT São Paulo calendar week always IS
// the program's planned-deload week, on whatever weekday this suite runs.
//
// advanceProgram stamps a finished session with effectiveProgramWeek: the
// enrollment's currentWeek, bumped by one only when NO earlier workout lies in
// the current calendar week. The deload flag is then read from the guidance for
// countedWeeks(that week). So a session finished "now" lands in the deload week
// iff (a) a workout already sits in this calendar week (no bump) and (b)
// currentWeek's guidance is the deload. Pinning both to the São Paulo week —
// not to a weekday offset — is what makes this deterministic: startOfWeek(now)
// is today's 00:00 on a Monday, so the old daysAgo(1) "this week" workout fell
// into LAST week and the counter bumped to a non-deload week (week 6 → 7).
const WEEKS_BEFORE_NOW = 5;
const THIS_MONDAY = startOfWeek(NOW);
// Monday noon, WEEKS_BEFORE_NOW weeks back: a Monday start has no Thursday–Sunday
// entry week, so every program week equals one calendar week (countedWeeks(w) === w).
const ENROLLMENT_STARTED_AT = new Date(THIS_MONDAY.getTime() - WEEKS_BEFORE_NOW * WEEK_MS + 12 * 3_600_000);
// The program week the current calendar week counts as, from the SAME week
// primitive the app uses (startOfWeek): the São Paulo week count since the
// start, + 1. Marking THIS week as the deload keeps the fixture self-consistent.
const DELOAD_WEEK = Math.round((THIS_MONDAY.getTime() - startOfWeek(ENROLLMENT_STARTED_AT).getTime()) / WEEK_MS) + 1;
const PRE_DELOAD_WEEK = DELOAD_WEEK - 1;
// Pre-deload 100 kg workout in the previous calendar week, plus one earlier THIS
// week placed midway between Monday 00:00 and now, so it never straddles the
// Monday boundary (a daysAgo(1) would fall into last week on a Monday).
const PRE_DELOAD_WORKOUT_AT = new Date(THIS_MONDAY.getTime() - WEEK_MS + 12 * 3_600_000);
const THIS_WEEK_WORKOUT_AT = new Date((THIS_MONDAY.getTime() + NOW.getTime()) / 2);

let enrollmentId: string;
let programId: string;
let dayId: string;
let squatId: string;

/**
 * Marks one set done through `syncSets` — the single workout write path the app
 * uses. Test-only helper preserving the old one-shot `logSet` ergonomics (the
 * `logSet`/`saveSetValues` server actions were removed in A-097).
 */
async function logSet(input: Omit<Parameters<typeof workouts.syncSets>[0][number], "done">) {
  const [r] = (await workouts.syncSets([{ ...input, done: true }])).results;
  if (r.ok) return { ok: true as const };
  return { ok: false as const, reason: r.reason === "GONE" ? ("CLOSED" as const) : r.reason };
}

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
      // DELOAD_WEEK is a PLANNED deload (not applied): a statement, not a condition.
      weeklyGuidance: [
        { week: PRE_DELOAD_WEEK, rirTarget: 2, notePt: "", setsNotePt: "" },
        { week: DELOAD_WEEK, rirTarget: 3, notePt: "", setsNotePt: "Deload: metade das séries, mesmas cargas." },
        { week: DELOAD_WEEK + 1, rirTarget: 2, notePt: "", setsNotePt: "" },
      ],
      days: { create: [{ dayIndex: 0, name: "Dia A", exercises: { create: [{ exerciseId: squatId, sortOrder: 0, sets: 3, repMin: 5, repMax: 8, rirTarget: 2, restSeconds: 120 }] } }] },
    },
    include: { days: true },
  });
  programId = program.id;
  dayId = program.days[0].id;
  // Started on a Monday so the current São Paulo calendar week is DELOAD_WEEK now (no entry week).
  enrollmentId = (
    await prisma.programEnrollment.create({
      data: { userId: USER_ID, programId, status: "ACTIVE", currentWeek: DELOAD_WEEK, startedAt: ENROLLMENT_STARTED_AT, programSnapshot: {} },
    })
  ).id;

  // Pre-deload squat at 100 kg (PRE_DELOAD_WEEK) last calendar week, plus one this
  // calendar week so advanceProgram keeps a session finished now in DELOAD_WEEK.
  await finished({ at: PRE_DELOAD_WORKOUT_AT, programWeek: PRE_DELOAD_WEEK, kg: 100, reps: 8 });
  await finished({ at: THIS_WEEK_WORKOUT_AT, programWeek: DELOAD_WEEK, kg: 100, reps: 8 });
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
    expect(await logSet({ setLogId: set.id, weightKg: 80, reps: 5, rir: 3 })).toEqual({ ok: true });
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
