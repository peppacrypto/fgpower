import "dotenv/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { SESSION_EXPIRED_ERROR } from "@/lib/auth/session-expired";

/**
 * "Trocar no plano" (applySwapToPlan), against the real local Postgres: a
 * stand-in picked mid-workout for a machine the gym doesn't have replaces
 * the exercise on every day of the plan that prescribes it — except a day
 * that already has the stand-in — drops the rows' notes, takes the new
 * unit's range across reps↔seconds, counts as a program save, and is
 * idempotent; only for the user's own workout in progress and own program,
 * and only for an exercise the gym really lacks (a machine that is only taken
 * stays in the plan).
 */

const RUN = `plan-swap-${Date.now()}`;
const USER = `${RUN}-u`;
const OTHER = `${RUN}-o`;

// The suite acts as two users (and as nobody): the auth mock reads `current`.
let current: string | null = USER;
vi.mock("@/lib/auth/require-user", () => ({
  requireUserOrThrow: async () => {
    if (!current) throw new Error("UNAUTHORIZED");
    return { id: current };
  },
  getCurrentSession: async () => (current ? { user: { id: current } } : null),
}));
const revalidated: string[] = [];
vi.mock("next/cache", () => ({
  revalidatePath: (path: string, type?: string) => {
    revalidated.push(type ? `${path}:${type}` : path);
  },
}));
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

/** Exercises of this run only: their gear comes from their catalog tag (lib/exercises/gear's fallback). */
let machineA: string; // barbell → gear "barbell": the one the gym lacks
let standIn: string; // dumbbell → "dumbbells"
let filler: string; // dumbbell
let plankId: string; // a timed hold (seconds)

/** The program's coaching note: it belongs to its exercise, never to a stand-in. */
const NOTE = "Desça em 3 s.";
/** A row whose numbers are seconds by its note (set-plan isTimedHold). */
const SECONDS_NOTE = "Os números são segundos de sustentação.";

async function mkUser(id: string, missingGear: string[] = []) {
  await prisma.user.create({ data: { id, name: id, email: `${id}@fgpower.test`, emailVerified: true } });
  await prisma.profile.create({ data: { userId: id, displayName: id, onboardingCompletedAt: new Date(), missingGear } });
}

async function mkExercise(suffix: string, equipmentId: string) {
  const e = await prisma.exercise.create({
    data: { slug: `${RUN}-${suffix}`, nameEn: suffix, namePt: `Exercício ${suffix}`, equipmentId, isPublished: true },
  });
  return e.id;
}

type Row = { exerciseId: string; notes?: string | null; repMin?: number; repMax?: number };

/**
 * A program for `userId` with these days (rows in order) and its ACTIVE
 * enrollment — the previous one retired (one ACTIVE enrollment per user, A-007).
 */
async function mkPlan(userId: string, days: Row[][]) {
  const program = await prisma.userProgram.create({
    data: {
      userId,
      name: `Plano ${RUN}`,
      status: "ACTIVE",
      daysPerWeek: days.length,
      days: {
        create: days.map((rows, dayIndex) => ({
          dayIndex,
          name: `Dia ${String.fromCharCode(65 + dayIndex)}`,
          exercises: {
            create: rows.map((r, sortOrder) => ({
              exerciseId: r.exerciseId,
              sortOrder,
              sets: 3,
              notes: r.notes ?? null,
              repMin: r.repMin ?? 8,
              repMax: r.repMax ?? 12,
            })),
          },
        })),
      },
    },
    include: { days: { orderBy: { dayIndex: "asc" } } },
  });
  await prisma.programEnrollment.updateMany({ where: { userId, status: "ACTIVE" }, data: { status: "ABANDONED" } });
  await prisma.programEnrollment.create({
    data: { userId, programId: program.id, status: "ACTIVE", currentWeek: 1, nextDayIndex: 0, programSnapshot: {} },
  });
  return { programId: program.id, dayIds: program.days.map((d) => d.id) };
}

/** Opens a program day as a workout in progress; returns the session id. */
async function startOn(dayId: string) {
  try {
    await actions.startAdHocWorkoutSession(dayId);
  } catch (err) {
    if (err instanceof Redirected) return err.url.split("/")[3].split("?")[0];
    throw err;
  }
  throw new Error("expected a redirect");
}

async function logsOf(sessionId: string) {
  return prisma.workoutExerciseLog.findMany({
    where: { sessionId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, exerciseId: true },
  });
}

/** The plan's rows, day by day, as [exerciseId, repMin, repMax, notes]. */
async function planRows(programId: string) {
  const days = await prisma.userProgramDay.findMany({
    where: { programId },
    orderBy: { dayIndex: "asc" },
    select: { exercises: { orderBy: { sortOrder: "asc" }, select: { exerciseId: true, repMin: true, repMax: true, notes: true } } },
  });
  return days.map((d) => d.exercises.map((r) => [r.exerciseId, r.repMin, r.repMax, r.notes] as const));
}

async function savedAt(programId: string) {
  return (await prisma.userProgram.findUniqueOrThrow({ where: { id: programId }, select: { updatedAt: true } })).updatedAt.getTime();
}

async function setMissing(userId: string, missingGear: string[]) {
  await prisma.profile.update({ where: { userId }, data: { missingGear } });
}

/** Closes whatever the user left open, so the next start opens a fresh workout. */
async function discardOpen(userId: string) {
  await prisma.workoutSession.updateMany({ where: { userId, status: "IN_PROGRESS" }, data: { status: "DISCARDED" } });
}

beforeAll(async () => {
  await mkUser(USER, ["barbell"]);
  await mkUser(OTHER, ["barbell"]);
  machineA = await mkExercise("machine-a", "barbell");
  standIn = await mkExercise("stand-in", "dumbbell");
  filler = await mkExercise("filler", "dumbbell");
  plankId = (await prisma.exercise.findUniqueOrThrow({ where: { slug: "plank" }, select: { id: true } })).id;
});

beforeEach(async () => {
  current = USER;
  revalidated.length = 0;
  await discardOpen(USER);
  await discardOpen(OTHER);
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [USER, OTHER] } } });
  await prisma.exercise.deleteMany({ where: { slug: { startsWith: RUN } } });
  await prisma.$disconnect();
});

describe("applySwapToPlan", () => {
  it("replaces the exercise on every day that prescribes it, skipping a day that has the stand-in", async () => {
    const { programId, dayIds } = await mkPlan(USER, [
      // A: the day trained now — its row keeps its own range, loses its note.
      [{ exerciseId: machineA, notes: NOTE, repMin: 6, repMax: 10 }, { exerciseId: filler }],
      // B: the same exercise timed by its note (seconds): the stand-in counts reps.
      [{ exerciseId: filler }, { exerciseId: machineA, notes: SECONDS_NOTE, repMin: 30, repMax: 45 }],
      // C: already has the stand-in — left as it is.
      [{ exerciseId: machineA }, { exerciseId: standIn }],
      // D: a top set and its back-offs (two slots of one lift): both follow.
      [{ exerciseId: machineA, repMin: 4, repMax: 6 }, { exerciseId: machineA, repMin: 8, repMax: 10 }],
    ]);
    const sessionId = await startOn(dayIds[0]);
    const [log] = await logsOf(sessionId);
    expect(await actions.swapExercise(log.id, standIn)).toEqual({ ok: true, exerciseLogId: log.id });
    const before = await savedAt(programId);

    expect(await actions.applySwapToPlan(log.id)).toEqual({ ok: true, changedRows: 4, skippedRows: 1, changedDays: 3 });
    expect(await planRows(programId)).toEqual([
      [
        [standIn, 6, 10, null],
        [filler, 8, 12, null],
      ],
      [
        [filler, 8, 12, null],
        [standIn, 8, 12, null],
      ],
      [
        [machineA, 8, 12, null],
        [standIn, 8, 12, null],
      ],
      [
        [standIn, 4, 6, null],
        [standIn, 8, 10, null],
      ],
    ]);
    // A program save: a builder draft kept from before now reads as older than the program.
    expect(await savedAt(programId)).toBeGreaterThan(before);
    expect(revalidated).toEqual(expect.arrayContaining(["/app/programs:layout", "/app/today"]));
    // The workout itself is untouched: it already holds the stand-in, in place of the program's exercise.
    expect(await prisma.workoutExerciseLog.findUniqueOrThrow({ where: { id: log.id } })).toMatchObject({
      exerciseId: standIn,
      substitutedFromExerciseId: machineA,
    });

    // Idempotent: a second tap (or a retry after a lost answer) changes nothing.
    const kept = await savedAt(programId);
    revalidated.length = 0;
    expect(await actions.applySwapToPlan(log.id)).toEqual({ ok: true, changedRows: 0, skippedRows: 1, changedDays: 0 });
    expect(await savedAt(programId)).toBe(kept);
    expect(revalidated).toEqual([]);
  });

  it("only for an exercise the gym lacks: a machine that is only taken today stays in the plan", async () => {
    const { programId, dayIds } = await mkPlan(USER, [[{ exerciseId: machineA }], [{ exerciseId: machineA }]]);
    await setMissing(USER, []);
    try {
      const sessionId = await startOn(dayIds[0]);
      const [log] = await logsOf(sessionId);
      await actions.swapExercise(log.id, standIn);
      const before = await savedAt(programId);
      expect(await actions.applySwapToPlan(log.id)).toEqual({ ok: true, changedRows: 0, skippedRows: 0, changedDays: 0 });
      expect((await planRows(programId)).flat().map(([id]) => id)).toEqual([machineA, machineA]);
      expect(await savedAt(programId)).toBe(before);
    } finally {
      await setMissing(USER, ["barbell"]);
    }
  });

  it("a swap into a timed hold takes the hold's range in seconds (A-058)", async () => {
    const { programId, dayIds } = await mkPlan(USER, [[{ exerciseId: machineA, repMin: 6, repMax: 10 }], [{ exerciseId: machineA }]]);
    const sessionId = await startOn(dayIds[0]);
    const [log] = await logsOf(sessionId);
    expect(await actions.swapExercise(log.id, plankId)).toEqual({ ok: true, exerciseLogId: log.id });
    expect(await actions.applySwapToPlan(log.id)).toEqual({ ok: true, changedRows: 2, skippedRows: 0, changedDays: 2 });
    expect(await planRows(programId)).toEqual([[[plankId, 20, 45, null]], [[plankId, 20, 45, null]]]);
  });

  it("a stand-in added after an exercise with sets stands in for that exercise's slot", async () => {
    const { programId, dayIds } = await mkPlan(USER, [
      [{ exerciseId: machineA, notes: NOTE }, { exerciseId: filler }],
      [{ exerciseId: machineA }],
    ]);
    const sessionId = await startOn(dayIds[0]);
    const [log] = await logsOf(sessionId);
    const set = await prisma.setLog.findFirstOrThrow({ where: { exerciseLogId: log.id, setType: "WORKING" } });
    await actions.syncSets([{ setLogId: set.id, weightKg: 40, reps: 8, rir: null, done: true }]);
    // "Trocar" on an exercise with sets: the pick goes after it (HAS_DATA path).
    expect(await actions.swapExercise(log.id, standIn)).toEqual({ ok: false, reason: "HAS_DATA" });
    const added = await actions.addExerciseToWorkout(sessionId, standIn, { after: log.id, replacing: true });
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(await actions.applySwapToPlan(added.exerciseLogId)).toEqual({ ok: true, changedRows: 2, skippedRows: 0, changedDays: 2 });
    expect(await planRows(programId)).toEqual([
      [
        [standIn, 8, 12, null],
        [filler, 8, 12, null],
      ],
      [[standIn, 8, 12, null]],
    ]);
  });

  it("a second stand-in, for a stand-in the gym lacks too, replaces what the plan asks for now", async () => {
    const { programId, dayIds } = await mkPlan(USER, [
      [{ exerciseId: machineA }],
      // Another day that asks for the first stand-in on its own.
      [{ exerciseId: standIn }, { exerciseId: filler }],
    ]);
    const sessionId = await startOn(dayIds[0]);
    const [log] = await logsOf(sessionId);
    await actions.swapExercise(log.id, standIn);
    expect(await actions.applySwapToPlan(log.id)).toMatchObject({ ok: true, changedRows: 1 });
    // The gym has no dumbbells either: the stand-in goes as well, wherever the plan asks for it.
    await setMissing(USER, ["barbell", "dumbbells"]);
    try {
      expect(await actions.swapExercise(log.id, plankId)).toEqual({ ok: true, exerciseLogId: log.id });
      expect(await actions.applySwapToPlan(log.id)).toEqual({ ok: true, changedRows: 2, skippedRows: 0, changedDays: 2 });
      expect(await planRows(programId)).toEqual([
        [[plankId, 20, 45, null]],
        [
          [plankId, 20, 45, null],
          [filler, 8, 12, null],
        ],
      ]);
    } finally {
      await setMissing(USER, ["barbell"]);
    }
  });

  it("only the user's own workout in progress, on their own program", async () => {
    const { programId, dayIds } = await mkPlan(USER, [[{ exerciseId: machineA }], [{ exerciseId: machineA }]]);
    const sessionId = await startOn(dayIds[0]);
    const [log] = await logsOf(sessionId);
    await actions.swapExercise(log.id, standIn);
    const untouched = await planRows(programId);

    // Signed out: said as such (the screen offers "Entrar").
    current = null;
    expect(await actions.applySwapToPlan(log.id)).toEqual({ ok: false, error: SESSION_EXPIRED_ERROR });
    // Someone else's log.
    current = OTHER;
    expect((await actions.applySwapToPlan(log.id)).ok).toBe(false);
    current = USER;
    // Nothing that is a log id.
    expect((await actions.applySwapToPlan("")).ok).toBe(false);
    expect((await actions.applySwapToPlan(42 as unknown as string)).ok).toBe(false);
    expect(await planRows(programId)).toEqual(untouched);

    // A workout no longer in progress (discarded, finished): "Usar no programa" on the summary is its way.
    await prisma.workoutSession.update({ where: { id: sessionId }, data: { status: "DISCARDED" } });
    expect((await actions.applySwapToPlan(log.id)).ok).toBe(false);
    expect(await planRows(programId)).toEqual(untouched);

    // A log of the user's that points at another user's program row: never written.
    const theirs = await mkPlan(OTHER, [[{ exerciseId: machineA }]]);
    const theirRow = await prisma.userProgramExercise.findFirstOrThrow({ where: { day: { programId: theirs.programId } } });
    const own = await startOn(dayIds[1]);
    const [ownLog] = await logsOf(own);
    await actions.swapExercise(ownLog.id, standIn);
    await prisma.workoutExerciseLog.update({ where: { id: ownLog.id }, data: { programExerciseId: theirRow.id } });
    expect((await actions.applySwapToPlan(ownLog.id)).ok).toBe(false);
    expect((await planRows(theirs.programId)).flat().map(([id]) => id)).toEqual([machineA]);
  });

  it("an exercise added to the workout (no program slot) has no plan to change", async () => {
    const { dayIds } = await mkPlan(USER, [[{ exerciseId: filler }]]);
    const sessionId = await startOn(dayIds[0]);
    const added = await actions.addExerciseToWorkout(sessionId, machineA);
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    await actions.swapExercise(added.exerciseLogId, standIn);
    expect((await actions.applySwapToPlan(added.exerciseLogId)).ok).toBe(false);
  });
});
