import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { dayNumberOf, mondayOf } from "@/lib/training/day-rotation";
import { startOfWeek } from "@/lib/training/week";
import { notificationKey } from "./notifications";

/**
 * The achievements log (W-043, D-E, D-F), driven through the real workout
 * actions against the local Postgres: one PERSONAL_RECORD row per workout with
 * a record (updated by a correction, gone with the record or the workout),
 * one PROGRAM_WEEK_COMPLETE row per week the first time it counts (deload
 * weeks included), one WORKOUT_MILESTONE row per milestone — all created
 * already read.
 */

const RUN_ID = `achv-${Date.now()}`;
let currentUser = "";

vi.mock("@/lib/auth/require-user", () => ({
  requireUserOrThrow: async () => ({ id: currentUser }),
  getCurrentSession: async () => ({ user: { id: currentUser } }),
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

const actions = await import("@/lib/actions/workouts");
const { syncMilestoneNotification, syncWeekCompleteNotification } = await import("./achievement-notifications");

async function redirectOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (err) {
    if (err instanceof Redirected) return err.url;
    throw err;
  }
  throw new Error("expected a redirect");
}

let exerciseId: string;
let exerciseName: string;
const userIds: string[] = [];

/** A user on a 3-day program (every day starts with the same exercise), enrolled two weeks ago. */
async function newLifter(label: string, opts: { deloadThisWeek?: boolean } = {}) {
  const userId = `${RUN_ID}-${label}`;
  userIds.push(userId);
  await prisma.user.create({ data: { id: userId, name: label, email: `${userId}@fgpower.test`, emailVerified: true } });
  await prisma.profile.create({ data: { userId, displayName: label, onboardingCompletedAt: new Date(), daysPerWeek: 3 } });
  const program = await prisma.userProgram.create({
    data: {
      userId,
      name: "Bloco Teste",
      status: "ACTIVE",
      daysPerWeek: 3,
      days: {
        create: ["Dia A", "Dia B", "Dia C"].map((name, dayIndex) => ({
          dayIndex,
          name,
          exercises: { create: [{ exerciseId, sortOrder: 0, sets: 3 }] },
        })),
      },
    },
    include: { days: { orderBy: { dayIndex: "asc" } } },
  });
  const startedAt = new Date(startOfWeek(new Date()).getTime() - 14 * 86_400_000);
  await prisma.programEnrollment.create({
    data: {
      userId,
      programId: program.id,
      status: "ACTIVE",
      currentWeek: 1,
      nextDayIndex: 0,
      programSnapshot: {},
      startedAt,
      deloadMondays: opts.deloadThisWeek ? [mondayOf(dayNumberOf(new Date()))] : [],
    },
  });
  return { userId, dayIds: program.days.map((d) => d.id) };
}

/** Starts a program day, ✓'s one set and finishes it. Returns the session id. */
async function train(userId: string, dayId: string, weightKg: number) {
  currentUser = userId;
  const url = await redirectOf(actions.startAdHocWorkoutSession(dayId));
  const sessionId = url.split("/")[3].split("?")[0];
  const set = await prisma.setLog.findFirstOrThrow({
    where: { sessionId, setType: "WORKING" },
    orderBy: [{ exerciseLog: { sortOrder: "asc" } }, { setNumber: "asc" }],
  });
  expect(await actions.logSet({ setLogId: set.id, weightKg, reps: 10, rir: null })).toEqual({ ok: true });
  expect(await redirectOf(actions.finishWorkoutSession(sessionId))).toBe(`/app/workout/${sessionId}/summary`);
  return sessionId;
}

const rows = (userId: string, type: string) =>
  prisma.notification.findMany({ where: { recipientId: userId, type: type as never }, orderBy: { createdAt: "asc" } });

beforeAll(async () => {
  const exercise = await prisma.exercise.findFirstOrThrow({
    where: { isPublished: true, equipment: { category: "FREE_WEIGHT" } },
    select: { id: true, namePt: true },
    orderBy: { slug: "asc" },
  });
  exerciseId = exercise.id;
  exerciseName = exercise.namePt;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe("records and the week (W-043)", () => {
  let lifter: { userId: string; dayIds: string[] };
  let first: string, second: string, third: string;

  beforeAll(async () => {
    lifter = await newLifter("semana");
  });

  it("a baseline workout logs nothing; a record logs one row, read, naming the exercise", async () => {
    first = await train(lifter.userId, lifter.dayIds[0], 40);
    expect(await rows(lifter.userId, "PERSONAL_RECORD")).toHaveLength(0);

    second = await train(lifter.userId, lifter.dayIds[1], 50);
    const [row] = await rows(lifter.userId, "PERSONAL_RECORD");
    expect(row).toMatchObject({ actorId: null, sessionId: second, dedupeKey: notificationKey.records(second) });
    expect(row.readAt).not.toBeNull();
    expect(row.data).toEqual({ sessionId: second, count: 1, exercises: [exerciseName] });

    // Finishing again (a double tap) changes nothing.
    currentUser = lifter.userId;
    await actions.finishWorkoutSession(second).catch(() => null);
    expect(await rows(lifter.userId, "PERSONAL_RECORD")).toHaveLength(1);
  });

  it("the week logs once, read, the first time it counts", async () => {
    expect(await rows(lifter.userId, "PROGRAM_WEEK_COMPLETE")).toHaveLength(0);
    third = await train(lifter.userId, lifter.dayIds[2], 30);
    const weekRows = await rows(lifter.userId, "PROGRAM_WEEK_COMPLETE");
    expect(weekRows).toHaveLength(1);
    const monday = mondayOf(dayNumberOf(new Date()));
    expect(weekRows[0]).toMatchObject({ dedupeKey: notificationKey.week(monday), sessionId: third, actorId: null });
    expect(weekRows[0].readAt).not.toBeNull();
    expect(weekRows[0].data).toMatchObject({ monday, done: 3, target: 3, deload: false, programName: "Bloco Teste" });

    // Another workout the same week: still one.
    await train(lifter.userId, lifter.dayIds[0], 30);
    expect(await rows(lifter.userId, "PROGRAM_WEEK_COMPLETE")).toHaveLength(1);
    // Nothing is unread: achievements never light the pip.
    expect(await prisma.notification.count({ where: { recipientId: lifter.userId, readAt: null } })).toBe(0);
  });

  it("a workout saved into a week already over logs no week", async () => {
    const lastWeek = new Date(startOfWeek(new Date()).getTime() - 86_400_000);
    await prisma.notification.deleteMany({ where: { recipientId: lifter.userId, type: "PROGRAM_WEEK_COMPLETE" } });
    await syncWeekCompleteNotification(lifter.userId, third, lastWeek, new Date());
    expect(await rows(lifter.userId, "PROGRAM_WEEK_COMPLETE")).toHaveLength(0);
    await syncWeekCompleteNotification(lifter.userId, third, new Date(), new Date());
    expect(await rows(lifter.userId, "PROGRAM_WEEK_COMPLETE")).toHaveLength(1);
  });

  it("a correction updates the row in place; one that removes the record removes the row", async () => {
    const [before] = await rows(lifter.userId, "PERSONAL_RECORD");
    const set = await prisma.setLog.findFirstOrThrow({ where: { sessionId: second, isCompleted: true } });
    currentUser = lifter.userId;
    await redirectOf(actions.editFinishedWorkout(second, [{ setLogId: set.id, weightKg: 55, reps: 10, rir: null }]));
    const [after] = await rows(lifter.userId, "PERSONAL_RECORD");
    expect(after.id).toBe(before.id);
    expect(after.createdAt).toEqual(before.createdAt);

    await redirectOf(actions.editFinishedWorkout(second, [{ setLogId: set.id, weightKg: 20, reps: 10, rir: null }]));
    expect(await prisma.notification.count({ where: { recipientId: lifter.userId, dedupeKey: notificationKey.records(second) } })).toBe(0);
  });

  it("deleting a workout takes its rows with it", async () => {
    const heavy = await train(lifter.userId, lifter.dayIds[1], 80);
    expect(await prisma.notification.count({ where: { sessionId: heavy } })).toBeGreaterThan(0);
    currentUser = lifter.userId;
    await redirectOf(actions.deleteWorkoutSession(heavy));
    expect(await prisma.notification.count({ where: { sessionId: heavy } })).toBe(0);
    expect(first).toBeTruthy();
  });
});

describe("a deload week (decision 16)", () => {
  it("counts with a single workout and says so", async () => {
    const lifter = await newLifter("deload", { deloadThisWeek: true });
    await train(lifter.userId, lifter.dayIds[0], 30);
    const [row] = await rows(lifter.userId, "PROGRAM_WEEK_COMPLETE");
    expect(row.data).toMatchObject({ deload: true, done: 1 });
    expect(row.readAt).not.toBeNull();
  });
});

describe("workout milestones (D-F)", () => {
  it("the 10th finished workout logs one WORKOUT_MILESTONE row, read, linked to it", async () => {
    const lifter = await newLifter("marco");
    const base = Date.now() - 30 * 86_400_000;
    await prisma.workoutSession.createMany({
      data: Array.from({ length: 9 }, (_, i) => ({
        userId: lifter.userId,
        name: `Antigo ${i + 1}`,
        status: "COMPLETED" as const,
        startedAt: new Date(base + i * 86_400_000),
        finishedAt: new Date(base + i * 86_400_000 + 3_600_000),
        totalWorkingSets: 1,
      })),
    });
    const tenth = await train(lifter.userId, lifter.dayIds[0], 30);
    const [row] = await rows(lifter.userId, "WORKOUT_MILESTONE");
    expect(row).toMatchObject({ sessionId: tenth, dedupeKey: notificationKey.milestone(10), data: { count: 10, sessionId: tenth } });
    expect(row.readAt).not.toBeNull();
    // Idempotent.
    await syncMilestoneNotification(lifter.userId, tenth, 10);
    expect(await rows(lifter.userId, "WORKOUT_MILESTONE")).toHaveLength(1);
  });
});
