import "dotenv/config";
import pg from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { startOfWeek } from "@/lib/training/week";
import { countedWeeks } from "@/lib/programming/block-progress";
import { entryWeekWasTrained } from "@/lib/data/program-lifecycle";

/**
 * Adapting a workout to the gym and correcting a finished one (Batch 4 —
 * W-006, W-088), against the real local Postgres: "Trocar" swaps an untouched
 * exercise in place (history reads the exercise performed) and refuses one
 * with sets; "Adicionar" goes after it with the sets still to do; a finished
 * workout's typo is corrected with its records and the later workouts'
 * records judged again (shared cards included); deleting the latest workout
 * puts the program back where the one before it left it, and an earlier one
 * that alone took its week takes that week with it; all of it only for 24 h.
 */

const RUN_ID = `adapt-${Date.now()}`;
const USER_ID = `${RUN_ID}-u`;

vi.mock("@/lib/auth/require-user", () => ({
  requireUserOrThrow: async () => ({ id: USER_ID }),
  getCurrentSession: async () => ({ user: { id: USER_ID } }),
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
const activities = await import("./activities");

let exerciseIds: string[];
/** The program's coaching note on its exercises: it belongs to them, never to a stand-in. */
const PROGRAM_NOTE = "Desça controlando, 3 s.";
let programId: string;
let enrollmentId: string;
let dayIds: string[];

/** Runs an action that answers with a redirect; returns the URL it went to. */
async function redirectOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (err) {
    if (err instanceof Redirected) return err.url;
    throw err;
  }
  throw new Error("expected a redirect");
}

/** Starts program day `day`, ✓'s one set of its first exercise and finishes it. Returns the session id. */
function trainDay(day: number, weightKg: number, reps = 10) {
  return trainOn(dayIds[day], weightKg, reps);
}

/** Opens a program day (a workout in progress, nothing logged). Returns the session id. */
async function startOn(dayId: string) {
  const url = await redirectOf(actions.startAdHocWorkoutSession(dayId));
  return url.split("/")[3].split("?")[0];
}

/** trainDay for any program's day. */
async function trainOn(dayId: string, weightKg: number, reps = 10) {
  const sessionId = await startOn(dayId);
  const set = await prisma.setLog.findFirstOrThrow({
    where: { sessionId, setType: "WORKING" },
    orderBy: [{ exerciseLog: { sortOrder: "asc" } }, { setNumber: "asc" }],
  });
  expect(await actions.logSet({ setLogId: set.id, weightKg, reps, rir: null })).toEqual({ ok: true });
  expect(await redirectOf(actions.finishWorkoutSession(sessionId))).toBe(`/app/workout/${sessionId}/summary`);
  return sessionId;
}

async function records(sessionId: string) {
  return prisma.exercisePersonalRecord.findMany({ where: { sessionId }, select: { kind: true, value: true } });
}

async function enrollment() {
  return prisma.programEnrollment.findUniqueOrThrow({
    where: { id: enrollmentId },
    select: { completedSessions: true, nextDayIndex: true, currentWeek: true },
  });
}

beforeAll(async () => {
  await prisma.user.create({ data: { id: USER_ID, name: USER_ID, email: `${USER_ID}@fgpower.test`, emailVerified: true } });
  await prisma.profile.create({ data: { userId: USER_ID, displayName: "Teste", onboardingCompletedAt: new Date() } });
  // Loaded free-weight exercises: every day starts with the same one (records are per exercise).
  exerciseIds = (
    await prisma.exercise.findMany({
      where: { isPublished: true, equipment: { category: "FREE_WEIGHT" } },
      select: { id: true },
      take: 5,
      orderBy: { slug: "asc" },
    })
  ).map((e) => e.id);
  const program = await prisma.userProgram.create({
    data: {
      userId: USER_ID,
      name: "Adaptar",
      status: "ACTIVE",
      daysPerWeek: 3,
      days: {
        create: ["Dia A", "Dia B", "Dia C"].map((name, dayIndex) => ({
          dayIndex,
          name,
          exercises: {
            create: [
              { exerciseId: exerciseIds[0], sortOrder: 0, sets: 3, notes: PROGRAM_NOTE },
              { exerciseId: exerciseIds[1], sortOrder: 1, sets: 3, notes: PROGRAM_NOTE },
            ],
          },
        })),
      },
    },
    include: { days: { orderBy: { dayIndex: "asc" } } },
  });
  programId = program.id;
  dayIds = program.days.map((d) => d.id);
  enrollmentId = (
    await prisma.programEnrollment.create({
      data: { userId: USER_ID, programId, status: "ACTIVE", currentWeek: 1, nextDayIndex: 0, programSnapshot: {} },
    })
  ).id;
});

/** An exercise taken out of the library (created here, removed after). */
const UNPUBLISHED_SLUG = `${RUN_ID}-unpublished`;

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: USER_ID } });
  await prisma.exercise.deleteMany({ where: { slug: UNPUBLISHED_SLUG } });
  await prisma.$disconnect();
});

const DAY_MS = 86_400_000;

/**
 * Another block for the same user: a fresh program (two days, both starting
 * with the same exercise) and its ACTIVE enrollment, started at `startedAt`.
 */
async function newBlock(opts: { startedAt: Date; days?: number; durationWeeks?: number }) {
  const program = await prisma.userProgram.create({
    data: {
      userId: USER_ID,
      name: `Bloco ${opts.startedAt.toISOString()}`,
      status: "ACTIVE",
      daysPerWeek: opts.days ?? 2,
      durationWeeks: opts.durationWeeks ?? null,
      days: {
        create: Array.from({ length: opts.days ?? 2 }, (_, dayIndex) => ({
          dayIndex,
          name: `Dia ${String.fromCharCode(65 + dayIndex)}`,
          exercises: { create: [{ exerciseId: exerciseIds[0], sortOrder: 0, sets: 3 }] },
        })),
      },
    },
    include: { days: { orderBy: { dayIndex: "asc" } } },
  });
  const e = await prisma.programEnrollment.create({
    data: { userId: USER_ID, programId: program.id, status: "ACTIVE", currentWeek: 1, nextDayIndex: 0, programSnapshot: {}, startedAt: opts.startedAt },
  });
  return { programId: program.id, dayIds: program.days.map((d) => d.id), enrollmentId: e.id };
}

/** Dates a finished workout (just saved) as done at `at` — as if it had been finished then; its save stays. */
async function finishedAt(sessionId: string, at: Date) {
  const s = await prisma.workoutSession.findUniqueOrThrow({ where: { id: sessionId }, select: { updatedAt: true } });
  await prisma.workoutSession.update({
    where: { id: sessionId },
    data: { startedAt: new Date(at.getTime() - 3_600_000), finishedAt: at, updatedAt: s.updatedAt },
  });
  await prisma.setLog.updateMany({ where: { sessionId, isCompleted: true }, data: { completedAt: at } });
}

async function blockState(id: string) {
  return prisma.programEnrollment.findUniqueOrThrow({
    where: { id },
    select: { status: true, currentWeek: true, completedSessions: true, startedAt: true },
  });
}

async function weekAndSave(sessionId: string) {
  return prisma.workoutSession.findUniqueOrThrow({ where: { id: sessionId }, select: { programWeek: true, updatedAt: true } });
}

/** The PRs a shared workout's card lists (Activity.summary, what the feed shows). */
async function cardRecords(sessionId: string) {
  const a = await prisma.activity.findUniqueOrThrow({ where: { sessionId }, select: { summary: true } });
  return ((a.summary as { prs?: { kind: string }[] }).prs ?? []).map((p) => p.kind);
}

describe("a finished workout can be corrected or deleted for 24 h", () => {
  let first: string;
  let typo: string;
  let later: string;

  it("a typo becomes a record that blocks the later ones", async () => {
    first = await trainDay(0, 22.5);
    typo = await trainDay(1, 225);
    later = await trainDay(2, 25);
    expect((await records(first)).length).toBe(0); // baseline
    expect((await records(typo)).map((r) => r.kind)).toContain("MAX_WEIGHT");
    expect((await records(later)).map((r) => r.kind)).not.toContain("MAX_WEIGHT");
    expect(await enrollment()).toMatchObject({ completedSessions: 3, nextDayIndex: 0 });
  });

  it("editing the typo recomputes its totals and records, and the later workout's", async () => {
    const set = await prisma.setLog.findFirstOrThrow({ where: { sessionId: typo, isCompleted: true } });
    const url = await redirectOf(
      actions.editFinishedWorkout(typo, [{ setLogId: set.id, weightKg: 22.5, reps: 10, rir: 2 }]),
    );
    expect(url).toBe(`/app/workout/${typo}/summary?corrigido=1`);
    const s = await prisma.workoutSession.findUniqueOrThrow({ where: { id: typo } });
    expect(s.totalVolumeKg).toBe(225);
    expect(s.totalWorkingSets).toBe(1);
    expect((await records(typo)).map((r) => r.kind)).not.toContain("MAX_WEIGHT");
    // 25 kg now beats everything before it.
    const fixed = await records(later);
    expect(fixed.find((r) => r.kind === "MAX_WEIGHT")?.value).toBe(25);
    // The program's counters don't move on an edit.
    expect(await enrollment()).toMatchObject({ completedSessions: 3, nextDayIndex: 0 });
  });

  it("an edit that would leave no working set is refused (that is a delete)", async () => {
    const set = await prisma.setLog.findFirstOrThrow({ where: { sessionId: typo, isCompleted: true } });
    const r = await actions.editFinishedWorkout(typo, [{ setLogId: set.id, weightKg: null, reps: null, rir: null, remove: true }]);
    expect(r).toEqual({ ok: false, reason: "EMPTY" });
    expect(await prisma.setLog.count({ where: { sessionId: typo, isCompleted: true } })).toBe(1);
  });

  it("deleting the latest workout puts the program back where the one before left it", async () => {
    expect(await redirectOf(actions.deleteWorkoutSession(later))).toBe("/app/today?excluido=1");
    expect(await prisma.workoutSession.count({ where: { id: later } })).toBe(0);
    // After Dia B (with Dia A done that week): Dia C is next again.
    expect(await enrollment()).toMatchObject({ completedSessions: 2, nextDayIndex: 2, currentWeek: 1 });
    expect(await redirectOf(actions.deleteWorkoutSession(typo))).toBe("/app/today?excluido=1");
    expect(await enrollment()).toMatchObject({ completedSessions: 1, nextDayIndex: 1 });
    // The first one: its own day is next again.
    expect(await redirectOf(actions.deleteWorkoutSession(first))).toBe("/app/today?excluido=1");
    expect(await enrollment()).toMatchObject({ completedSessions: 0, nextDayIndex: 0 });
  });

  it("deleting a workout re-judges the records of the later ones", async () => {
    const a = await trainDay(0, 100);
    const b = await trainDay(1, 90);
    expect((await records(b)).map((r) => r.kind)).not.toContain("MAX_WEIGHT");
    await redirectOf(actions.deleteWorkoutSession(a));
    // Without A, B is the first time: a baseline, never a record.
    expect(await records(b)).toEqual([]);
    await redirectOf(actions.deleteWorkoutSession(b));
  });

  it("deleting the block's only workout puts it back where it started, not on the deleted day", async () => {
    const only = await trainDay(2, 40);
    expect(await enrollment()).toMatchObject({ completedSessions: 1, currentWeek: 1 });
    await redirectOf(actions.deleteWorkoutSession(only));
    expect(await enrollment()).toMatchObject({ completedSessions: 0, nextDayIndex: 0, currentWeek: 1 });
  });

  it("a workout saved later on its own day can be corrected for 24 h after the save", async () => {
    const late = await trainDay(0, 40);
    // As "Salvar como feito em …" dates it: finished 3 days ago, saved now.
    const saved = await prisma.workoutSession.findUniqueOrThrow({ where: { id: late }, select: { updatedAt: true } });
    await prisma.workoutSession.update({
      where: { id: late },
      data: { finishedAt: new Date(Date.now() - 72 * 3_600_000), updatedAt: saved.updatedAt },
    });
    const set = await prisma.setLog.findFirstOrThrow({ where: { sessionId: late, isCompleted: true } });
    const url = await redirectOf(actions.editFinishedWorkout(late, [{ setLogId: set.id, weightKg: 42.5, reps: 10, rir: null }]));
    expect(url).toBe(`/app/workout/${late}/summary?corrigido=1`);
    // The correction doesn't extend the window.
    const after = await prisma.workoutSession.findUniqueOrThrow({ where: { id: late }, select: { updatedAt: true } });
    expect(after.updatedAt.getTime()).toBe(saved.updatedAt.getTime());
    await redirectOf(actions.deleteWorkoutSession(late));
  });

  it("past 24 h nothing can be changed", async () => {
    const old = await trainDay(0, 40);
    const past = new Date(Date.now() - 25 * 3_600_000);
    await prisma.workoutSession.update({ where: { id: old }, data: { finishedAt: past, updatedAt: past } });
    expect(await actions.deleteWorkoutSession(old)).toEqual({ ok: false, reason: "EXPIRED" });
    const set = await prisma.setLog.findFirstOrThrow({ where: { sessionId: old, isCompleted: true } });
    expect(await actions.editFinishedWorkout(old, [{ setLogId: set.id, weightKg: 41, reps: 10, rir: null }])).toEqual({
      ok: false,
      reason: "EXPIRED",
    });
    expect(await prisma.workoutSession.count({ where: { id: old } })).toBe(1);
  });
});

describe("a correction reaches the shared cards of the later workouts", () => {
  it("an edit that takes a later workout's record away takes it off its card", async () => {
    const base = await trainDay(0, 100, 5);
    const typo = await trainDay(1, 80, 5); // 120 meant
    const later = await trainDay(2, 110, 5);
    await activities.shareWorkoutSession({ sessionId: later, visibility: "PUBLIC", showDetailedLoads: false });
    expect(await cardRecords(later)).toContain("MAX_WEIGHT");
    const set = await prisma.setLog.findFirstOrThrow({ where: { sessionId: typo, isCompleted: true } });
    await redirectOf(actions.editFinishedWorkout(typo, [{ setLogId: set.id, weightKg: 120, reps: 5, rir: null }]));
    expect(await records(later)).toEqual([]);
    // Followers no longer see a record that doesn't stand.
    expect(await cardRecords(later)).toEqual([]);
    for (const id of [later, typo, base]) await redirectOf(actions.deleteWorkoutSession(id));
  });

  it("a delete that gives a later workout a record puts it on its card", async () => {
    const base = await trainDay(0, 100, 5);
    const heavy = await trainDay(1, 150, 5);
    const later = await trainDay(2, 120, 5);
    await activities.shareWorkoutSession({ sessionId: later, visibility: "FOLLOWERS", showDetailedLoads: true });
    expect(await cardRecords(later)).toEqual([]);
    await redirectOf(actions.deleteWorkoutSession(heavy));
    expect((await records(later)).map((r) => r.kind)).toContain("MAX_WEIGHT");
    expect(await cardRecords(later)).toContain("MAX_WEIGHT");
    for (const id of [later, base]) await redirectOf(actions.deleteWorkoutSession(id));
  });
});

describe("Trocar / Adicionar exercício mid-workout", () => {
  let sessionId: string;
  let logs: { id: string; exerciseId: string; sortOrder: number }[];

  it("swaps an untouched exercise in place, sets included, and back", async () => {
    const url = await redirectOf(actions.startAdHocWorkoutSession(dayIds[1]));
    sessionId = url.split("/")[3].split("?")[0];
    logs = await prisma.workoutExerciseLog.findMany({
      where: { sessionId },
      orderBy: { sortOrder: "asc" },
      select: { id: true, exerciseId: true, sortOrder: true },
    });
    const [first] = logs;
    expect(await actions.swapExercise(first.id, exerciseIds[2])).toEqual({ ok: true, exerciseLogId: first.id });
    const swapped = await prisma.workoutExerciseLog.findUniqueOrThrow({ where: { id: first.id } });
    // The program's note stays with the program's exercise.
    expect(swapped).toMatchObject({ exerciseId: exerciseIds[2], substitutedFromExerciseId: exerciseIds[0], notes: null });
    const sets = await prisma.setLog.findMany({ where: { exerciseLogId: first.id } });
    expect(sets.length).toBeGreaterThan(0);
    expect(sets.every((s) => s.exerciseId === exerciseIds[2])).toBe(true);
    // Swapped again, it stays "in place of" the program's exercise; back to it, it is plain again.
    await actions.swapExercise(first.id, exerciseIds[3]);
    expect(await prisma.workoutExerciseLog.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({
      exerciseId: exerciseIds[3],
      substitutedFromExerciseId: exerciseIds[0],
    });
    await actions.swapExercise(first.id, exerciseIds[0]);
    expect(await prisma.workoutExerciseLog.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({
      exerciseId: exerciseIds[0],
      substitutedFromExerciseId: null,
      notes: PROGRAM_NOTE,
    });
    // One already in the workout is refused: no second copy of it.
    expect(await actions.swapExercise(first.id, exerciseIds[1])).toEqual({ ok: false, reason: "DUPLICATE" });
    expect(await actions.addExerciseToWorkout(sessionId, exerciseIds[1])).toEqual({ ok: false, reason: "DUPLICATE" });
    expect(await prisma.workoutExerciseLog.count({ where: { sessionId, exerciseId: exerciseIds[1] } })).toBe(1);
  });

  it("refuses to swap an exercise with sets; adds the pick after it with the sets still to do", async () => {
    const [first, second] = logs;
    const set = await prisma.setLog.findFirstOrThrow({ where: { exerciseLogId: first.id, setType: "WORKING" }, orderBy: { setNumber: "asc" } });
    await actions.logSet({ setLogId: set.id, weightKg: 50, reps: 8, rir: null });
    expect(await actions.swapExercise(first.id, exerciseIds[2])).toEqual({ ok: false, reason: "HAS_DATA" });

    const added = await actions.addExerciseToWorkout(sessionId, exerciseIds[2], { after: first.id, replacing: true });
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    const all = await prisma.workoutExerciseLog.findMany({
      where: { sessionId },
      orderBy: { sortOrder: "asc" },
      select: { id: true, prescribedSets: true, substitutedFromExerciseId: true, sets: { select: { exerciseId: true } } },
    });
    // Right after the first exercise, before the second.
    expect(all.map((l) => l.id)).toEqual([first.id, added.exerciseLogId, second.id]);
    const stand = all[1];
    expect(stand.prescribedSets).toBe(2); // 3 prescribed, 1 done
    expect(stand.substitutedFromExerciseId).toBe(exerciseIds[0]);
    expect(stand.sets).toHaveLength(2);
    expect(stand.sets.every((s) => s.exerciseId === exerciseIds[2])).toBe(true);
  });

  it("adds an exercise at the end with a plain 3 × 8–12", async () => {
    const added = await actions.addExerciseToWorkout(sessionId, exerciseIds[3]);
    expect(added.ok).toBe(true);
    const last = await prisma.workoutExerciseLog.findFirstOrThrow({
      where: { sessionId },
      orderBy: { sortOrder: "desc" },
      select: { id: true, exerciseId: true, prescribedSets: true, repMin: true, repMax: true, substitutedFromExerciseId: true },
    });
    expect(added.ok && last.id === added.exerciseLogId).toBe(true);
    expect(last).toMatchObject({ exerciseId: exerciseIds[3], prescribedSets: 3, repMin: 8, repMax: 12, substitutedFromExerciseId: null });
  });

  it("the swap counts for the exercise performed; the summary can make it stick in the program", async () => {
    // The second exercise swapped before any set: the program's day asks for exerciseIds[1].
    const second = logs[1];
    expect(await actions.swapExercise(second.id, exerciseIds[4])).toEqual({ ok: true, exerciseLogId: second.id });
    const set = await prisma.setLog.findFirstOrThrow({ where: { exerciseLogId: second.id, setType: "WORKING" } });
    await actions.logSet({ setLogId: set.id, weightKg: 30, reps: 10, rir: null });
    await redirectOf(actions.finishWorkoutSession(sessionId));
    const done = await prisma.setLog.findFirstOrThrow({ where: { id: set.id } });
    expect(done.exerciseId).toBe(exerciseIds[4]);

    const programSaved = async () =>
      (await prisma.userProgram.findUniqueOrThrow({ where: { id: programId }, select: { updatedAt: true } })).updatedAt.getTime();
    const before = await programSaved();
    expect(await actions.keepSwapInProgram(second.id)).toEqual({ ok: true });
    const pe = await prisma.userProgramExercise.findFirstOrThrow({ where: { dayId: dayIds[1], sortOrder: 1 } });
    expect(pe.exerciseId).toBe(exerciseIds[4]);
    // The old exercise's note doesn't coach the new one.
    expect(pe.notes).toBeNull();
    // The program counts as saved now: a builder draft kept from before is older than it.
    const kept = await programSaved();
    expect(kept).toBeGreaterThan(before);
    // A second tap changes nothing.
    expect(await actions.keepSwapInProgram(second.id)).toEqual({ ok: true });
    expect(await programSaved()).toBe(kept);
    await redirectOf(actions.deleteWorkoutSession(sessionId));
  });
});

describe("the sheet's lists (getExerciseOptions, getTechniqueSheet)", () => {
  it("offers stand-ins not already in the workout, says when the exercise has sets, and searches", async () => {
    const { getExerciseOptions, getTechniqueSheet } = await import("@/lib/data/workout-session");
    const url = await redirectOf(actions.startAdHocWorkoutSession(dayIds[2]));
    const sessionId = url.split("/")[3].split("?")[0];
    const [log] = await prisma.workoutExerciseLog.findMany({ where: { sessionId }, orderBy: { sortOrder: "asc" } });

    const options = await getExerciseOptions(USER_ID, { sessionId, exerciseLogId: log.id });
    expect(options).not.toBeNull();
    expect(options!.hasData).toBe(false);
    const inWorkout = new Set([exerciseIds[0], exerciseIds[1]]);
    expect(options!.options.every((o) => !inWorkout.has(o.id))).toBe(true);
    // Before the curated relations land, same muscle (+ movement) still finds stand-ins.
    expect(options!.options.length).toBeGreaterThan(0);

    const set = await prisma.setLog.findFirstOrThrow({ where: { exerciseLogId: log.id, setType: "WORKING" } });
    await prisma.setLog.update({ where: { id: set.id }, data: { weightKg: 20 } });
    expect((await getExerciseOptions(USER_ID, { sessionId, exerciseLogId: log.id }))!.hasData).toBe(true);

    const search = await getExerciseOptions(USER_ID, { sessionId, exerciseLogId: log.id, q: "supino" });
    expect(search!.options.length).toBeGreaterThan(0);
    expect(search!.options.every((o) => o.reason === "SEARCH" && !inWorkout.has(o.id))).toBe(true);
    // Searched by name, one already in the workout still isn't offered.
    const other = await prisma.exercise.findUniqueOrThrow({ where: { id: exerciseIds[1] }, select: { namePt: true } });
    const byName = await getExerciseOptions(USER_ID, { sessionId, exerciseLogId: log.id, q: other.namePt });
    expect(byName!.options.some((o) => o.id === exerciseIds[1])).toBe(false);

    // Someone else's workout, or a closed one, lists nothing.
    expect(await getExerciseOptions(`${USER_ID}-other`, { sessionId, exerciseLogId: log.id })).toBeNull();
    await actions.discardWorkoutSession(sessionId);
    expect(await getExerciseOptions(USER_ID, { sessionId, exerciseLogId: log.id })).toBeNull();

    const technique = await getTechniqueSheet(log.exerciseId);
    expect(technique).not.toBeNull();
    expect(technique!.cues.length).toBeLessThanOrEqual(3);
    expect(technique!.images.start).toBeTruthy();

    // One taken out of the library can still be in a workout: its technique still opens.
    const hidden = await prisma.exercise.create({
      data: {
        slug: UNPUBLISHED_SLUG,
        nameEn: "Retired",
        namePt: "Exercício retirado",
        isPublished: false,
        instructionsPt: ["Primeiro passo.", "Segundo passo."],
      },
    });
    expect(await getTechniqueSheet(hidden.id)).toMatchObject({
      namePt: "Exercício retirado",
      cues: ["Primeiro passo.", "Segundo passo."],
      source: "instructions",
    });
    expect(await getTechniqueSheet(`${RUN_ID}-missing`)).toBeNull();
  });
});

describe("Trocar / Adicionar against each other and against set writes", () => {
  // Each test's workout is discarded at the end, passed or not: an open one with sets would block the next start.
  const open: string[] = [];
  afterEach(async () => {
    for (const id of open.splice(0)) await actions.discardWorkoutSession(id);
  });

  it("a swap waits for a set being written on another device, then refuses it (HAS_DATA)", async () => {
    const b = await newBlock({ startedAt: new Date(startOfWeek(new Date()).getTime() - 14 * DAY_MS) });
    const sessionId = await startOn(b.dayIds[0]);
    open.push(sessionId);
    const [log] = await prisma.workoutExerciseLog.findMany({ where: { sessionId }, orderBy: { sortOrder: "asc" } });
    const set = await prisma.setLog.findFirstOrThrow({
      where: { exerciseLogId: log.id, setType: "WORKING" },
      orderBy: { setNumber: "asc" },
    });
    const device = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await device.connect();
    try {
      // writeSet's shape: the session locked FOR SHARE and the row written — not committed yet.
      await device.query("BEGIN");
      await device.query(
        `SELECT 1 FROM "SetLog" l JOIN "WorkoutSession" s ON s.id = l."sessionId" WHERE l.id = $1 FOR SHARE OF s`,
        [set.id],
      );
      await device.query(
        `UPDATE "SetLog" SET "weightKg" = 100, reps = 8, "isCompleted" = true, "completedAt" = now() WHERE id = $1`,
        [set.id],
      );
      let settled = false;
      const swap = actions.swapExercise(log.id, exerciseIds[2]).finally(() => {
        settled = true;
      });
      await new Promise((r) => setTimeout(r, 500));
      expect(settled).toBe(false);
      await device.query("COMMIT");
      expect(await swap).toEqual({ ok: false, reason: "HAS_DATA" });
    } finally {
      await device.end();
    }
    // The logged set never changed exercise under the user.
    expect(await prisma.setLog.findUniqueOrThrow({ where: { id: set.id } })).toMatchObject({
      exerciseId: exerciseIds[0],
      isCompleted: true,
      weightKg: 100,
    });

    // Two adds of the same pick at once (a double tap, two devices): one copy.
    const [x, y] = await Promise.all([
      actions.addExerciseToWorkout(sessionId, exerciseIds[3]),
      actions.addExerciseToWorkout(sessionId, exerciseIds[3]),
    ]);
    expect([x.ok, y.ok].sort()).toEqual([false, true]);
    expect([x, y].find((r) => !r.ok)).toEqual({ ok: false, reason: "DUPLICATE" });
    expect(await prisma.workoutExerciseLog.count({ where: { sessionId, exerciseId: exerciseIds[3] } })).toBe(1);
  });

  it("swapping back to the program's exercise is refused once it was added elsewhere in the workout", async () => {
    const { getExerciseOptions } = await import("@/lib/data/workout-session");
    const b = await newBlock({ startedAt: new Date(startOfWeek(new Date()).getTime() - 14 * DAY_MS) });
    const sessionId = await startOn(b.dayIds[1]);
    open.push(sessionId);
    const [log] = await prisma.workoutExerciseLog.findMany({ where: { sessionId }, orderBy: { sortOrder: "asc" } });
    const program = await prisma.exercise.findUniqueOrThrow({ where: { id: exerciseIds[0] }, select: { namePt: true } });
    const offersBack = async () =>
      (await getExerciseOptions(USER_ID, { sessionId, exerciseLogId: log.id, q: program.namePt }))!.options.some(
        (o) => o.id === exerciseIds[0],
      );

    expect(await actions.swapExercise(log.id, exerciseIds[2])).toEqual({ ok: true, exerciseLogId: log.id });
    expect(await offersBack()).toBe(true);
    // The program's exercise, added at the end meanwhile: going back to it would be a second copy.
    expect((await actions.addExerciseToWorkout(sessionId, exerciseIds[0])).ok).toBe(true);
    expect(await offersBack()).toBe(false);
    expect(await actions.swapExercise(log.id, exerciseIds[0])).toEqual({ ok: false, reason: "DUPLICATE" });
    expect(await prisma.workoutExerciseLog.count({ where: { sessionId, exerciseId: exerciseIds[0] } })).toBe(1);
  });
});

describe("deleting an earlier workout that alone took its program week", () => {
  const monday = () => startOfWeek(new Date());
  /** 20:00 (São Paulo) on the Sunday before this calendar week. */
  const lastSunday = () => new Date(monday().getTime() - 4 * 3_600_000);

  it("Sunday's workout deleted after Monday's: Monday's goes back to week 1, its window untouched", async () => {
    const b = await newBlock({ startedAt: new Date(monday().getTime() - 14 * DAY_MS) });
    const sunday = await trainOn(b.dayIds[0], 50);
    await finishedAt(sunday, lastSunday());
    // Monday's opens week 2 — only because Sunday's was there.
    const mon = await trainOn(b.dayIds[1], 50);
    expect(await blockState(b.enrollmentId)).toMatchObject({ currentWeek: 2, completedSessions: 2 });
    const before = await weekAndSave(mon);
    expect(before.programWeek).toBe(2);

    await redirectOf(actions.deleteWorkoutSession(sunday));
    // As if only Monday's had ever been done.
    expect(await blockState(b.enrollmentId)).toMatchObject({ currentWeek: 1, completedSessions: 1 });
    const after = await weekAndSave(mon);
    expect(after.programWeek).toBe(1);
    // Relabelled, not saved again: its own correction window still runs from its save.
    expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
  });

  it("the entry week's only workout deleted: the next week's workout still reads as week 1", async () => {
    // Activated last Thursday: that short entry week takes a number only when trained.
    const startedAt = new Date(monday().getTime() - 4 * DAY_MS + 10 * 3_600_000);
    const b = await newBlock({ startedAt });
    const sunday = await trainOn(b.dayIds[0], 50);
    await finishedAt(sunday, lastSunday());
    const mon = await trainOn(b.dayIds[1], 50);
    const shownWeek = async () =>
      countedWeeks(
        (await weekAndSave(mon)).programWeek ?? 0,
        startedAt,
        await entryWeekWasTrained(prisma, { id: b.enrollmentId, userId: USER_ID, startedAt }),
      );
    expect(await shownWeek()).toBe(1);
    await redirectOf(actions.deleteWorkoutSession(sunday));
    expect(await shownWeek()).toBe(1);
    expect(await blockState(b.enrollmentId)).toMatchObject({ currentWeek: 1, completedSessions: 1 });
  });

  it("one that shared its week moved nothing: the later workouts keep theirs", async () => {
    const b = await newBlock({ startedAt: new Date(monday().getTime() - 14 * DAY_MS) });
    const saturday = await trainOn(b.dayIds[0], 50);
    const sunday = await trainOn(b.dayIds[1], 50);
    await finishedAt(saturday, new Date(lastSunday().getTime() - 34 * 3_600_000));
    await finishedAt(sunday, lastSunday());
    const mon = await trainOn(b.dayIds[0], 50);
    expect((await weekAndSave(mon)).programWeek).toBe(2);
    await redirectOf(actions.deleteWorkoutSession(sunday));
    expect((await weekAndSave(mon)).programWeek).toBe(2);
    expect(await blockState(b.enrollmentId)).toMatchObject({ currentWeek: 2, completedSessions: 2 });
  });
});

describe("deleting a workout finished after its block stopped", () => {
  it("counts the block's workouts again instead of taking away one it never added", async () => {
    const b = await newBlock({ startedAt: new Date(startOfWeek(new Date()).getTime() - 14 * DAY_MS) });
    await trainOn(b.dayIds[0], 50);
    const late = await startOn(b.dayIds[1]);
    const set = await prisma.setLog.findFirstOrThrow({ where: { sessionId: late, setType: "WORKING" }, orderBy: { setNumber: "asc" } });
    expect(await actions.logSet({ setLogId: set.id, weightKg: 50, reps: 10, rir: null })).toEqual({ ok: true });
    // Another program started with this workout open: the block stopped, the workout stays linked to it.
    await prisma.programEnrollment.update({ where: { id: b.enrollmentId }, data: { status: "ABANDONED", endedAt: new Date() } });
    await redirectOf(actions.finishWorkoutSession(late));
    expect(await blockState(b.enrollmentId)).toMatchObject({ completedSessions: 1 });
    await redirectOf(actions.deleteWorkoutSession(late));
    expect(await blockState(b.enrollmentId)).toMatchObject({ completedSessions: 1 });
  });
});

describe("a block its last workout closed", () => {
  it("runs again when that workout is deleted — its program too, though made a draft meanwhile", async () => {
    // A closed block reopens only while nothing else runs.
    await prisma.programEnrollment.updateMany({
      where: { userId: USER_ID, status: "ACTIVE" },
      data: { status: "ABANDONED", endedAt: new Date() },
    });
    const b = await newBlock({ startedAt: startOfWeek(new Date()), days: 1, durationWeeks: 1 });
    const last = await trainOn(b.dayIds[0], 50);
    expect(await blockState(b.enrollmentId)).toMatchObject({ status: "COMPLETED" });
    const programOf = () =>
      prisma.userProgram.findUniqueOrThrow({ where: { id: b.programId }, select: { status: true, archivedAt: true } });
    expect((await programOf()).status).toBe("ARCHIVED");
    // "Restaurar" (or a save in the builder) made the archived program a draft.
    await prisma.userProgram.update({ where: { id: b.programId }, data: { status: "DRAFT", archivedAt: null } });
    await redirectOf(actions.deleteWorkoutSession(last));
    expect(await blockState(b.enrollmentId)).toMatchObject({ status: "ACTIVE", completedSessions: 0 });
    // The running block's program — never a draft "Descartar rascunho" would delete with it.
    expect(await programOf()).toEqual({ status: "ACTIVE", archivedAt: null });
  });
});
