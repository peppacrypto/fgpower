import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { startOfWeek } from "@/lib/training/week";
import {
  applyWeekLayout,
  closeBlock,
  describeCompletedBlock,
  entryWeekWasTrained,
  getProgramRestart,
  getRecentlyCompletedBlock,
  getSeriesContinuation,
  recordWorkoutMilestone,
  settleFinishedBlock,
} from "./program-lifecycle";

/**
 * The block lifecycle against the real local Postgres: a block closes once
 * (COMPLETED, archived, one private activity + one notification), the
 * calendar closes a block whose last week is over, the finished block offers
 * the GD series' next one, a stopped block resumes at the right week, days go
 * onto the user's week, and the workout-count milestones are recorded once.
 */

const RUN_ID = `lifecycle-${Date.now()}`;
const USER_ID = `${RUN_ID}-u`;
const MILESTONE_USER = `${RUN_ID}-m`;
const ENTRY_USER = `${RUN_ID}-e`;
const GRADUATE_USER = `${RUN_ID}-g`;
const DAY_MS = 86_400_000;
const now = new Date();
/** Monday noon (São Paulo) `weeksAgo` weeks back. */
const monday = (weeksAgo: number) => new Date(startOfWeek(now).getTime() - weeksAgo * 7 * DAY_MS + 12 * 3_600_000);

let programId: string;
let dayIds: string[];
let exerciseId: string;

/** One logged exercise with one working set, in a session. */
async function lift(sessionId: string, weightKg: number, reps: number) {
  const log = await prisma.workoutExerciseLog.create({
    data: { sessionId, userId: USER_ID, exerciseId, sortOrder: 0, prescribedSets: 3, repMin: 8, repMax: 12, restSeconds: 90 },
  });
  await prisma.setLog.create({
    data: { userId: USER_ID, sessionId, exerciseLogId: log.id, exerciseId, setNumber: 1, weightKg, reps, isCompleted: true },
  });
}

async function session(p: { enrollmentId: string | null; programWeek: number | null; day: number; at: Date; userId?: string }) {
  return prisma.workoutSession.create({
    data: {
      userId: p.userId ?? USER_ID,
      enrollmentId: p.enrollmentId,
      programId: p.enrollmentId ? programId : null,
      programDayId: p.enrollmentId ? dayIds[p.day] : null,
      name: `Dia ${p.day + 1}`,
      status: "COMPLETED",
      startedAt: new Date(p.at.getTime() - 3_600_000),
      finishedAt: p.at,
      totalWorkingSets: 3,
      programWeek: p.programWeek,
    },
    select: { id: true },
  });
}

beforeAll(async () => {
  for (const id of [USER_ID, MILESTONE_USER, ENTRY_USER, GRADUATE_USER]) {
    await prisma.user.create({ data: { id, name: id, email: `${id}@fgpower.test`, emailVerified: true } });
  }
  await prisma.profile.create({
    data: { userId: USER_ID, displayName: "Lifecycle", daysPerWeek: 4, preferredDays: [2, 4, 6] },
  });
  const adaptacao = await prisma.workoutTemplate.findUniqueOrThrow({ where: { slug: "gd-adaptacao" }, select: { id: true } });
  const program = await prisma.userProgram.create({
    data: {
      userId: USER_ID,
      name: "GD Adaptação",
      status: "ACTIVE",
      daysPerWeek: 3,
      durationWeeks: 2,
      sourceTemplateId: adaptacao.id,
      days: { create: ["Sessão A", "Sessão B", "Sessão C"].map((name, dayIndex) => ({ name, dayIndex })) },
    },
    include: { days: { orderBy: { dayIndex: "asc" } } },
  });
  programId = program.id;
  dayIds = program.days.map((d) => d.id);
  exerciseId = (await prisma.exercise.findFirstOrThrow({ select: { id: true }, orderBy: { id: "asc" } })).id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [USER_ID, MILESTONE_USER, ENTRY_USER, GRADUATE_USER] } } });
  await prisma.$disconnect();
});

describe("applyWeekLayout", () => {
  it("puts the days on the user's weekdays and the program's frequency on the profile", async () => {
    await applyWeekLayout(prisma, USER_ID, programId);
    const days = await prisma.userProgramDay.findMany({ where: { programId }, orderBy: { dayIndex: "asc" } });
    expect(days.map((d) => d.weekday)).toEqual([2, 4, 6]);
    const profile = await prisma.profile.findUniqueOrThrow({ where: { userId: USER_ID } });
    expect(profile.daysPerWeek).toBe(3);
    expect(profile.preferredDays).toEqual([2, 4, 6]);
  });
});

describe("closing a block", () => {
  let enrollmentId: string;

  it("the calendar doesn't close the last week while it's still going", async () => {
    const e = await prisma.programEnrollment.create({
      data: { userId: USER_ID, programId, status: "ACTIVE", currentWeek: 2, startedAt: monday(2), plannedSessions: 6, programSnapshot: {} },
    });
    enrollmentId = e.id;
    for (let d = 0; d < 3; d++) {
      const s = await session({ enrollmentId, programWeek: 1, day: d, at: new Date(monday(2).getTime() + d * DAY_MS) });
      if (d === 0) await lift(s.id, 60, 8);
    }
    const thisWeek = await session({ enrollmentId, programWeek: 2, day: 0, at: new Date(now.getTime() - 60_000) });
    await lift(thisWeek.id, 65, 8);
    expect(await settleFinishedBlock(USER_ID, now)).toBe(false);
    // The same last-week workout, a week earlier: the block's last week is over.
    await prisma.workoutSession.update({
      where: { id: thisWeek.id },
      data: { finishedAt: new Date(monday(1).getTime() + DAY_MS), startedAt: monday(1) },
    });
    expect(await settleFinishedBlock(USER_ID, now)).toBe(true);
  });

  it("completes the enrollment once, archives the program, and records it privately", async () => {
    expect(await closeBlock(prisma, { userId: USER_ID, enrollmentId, now })).toBe(false);
    const e = await prisma.programEnrollment.findUniqueOrThrow({ where: { id: enrollmentId } });
    expect(e.status).toBe("COMPLETED");
    expect(e.endedAt).not.toBeNull();
    const program = await prisma.userProgram.findUniqueOrThrow({ where: { id: programId } });
    expect(program.status).toBe("ARCHIVED");
    const activities = await prisma.activity.findMany({ where: { userId: USER_ID, type: "PROGRAM_COMPLETED" } });
    expect(activities).toHaveLength(1);
    expect(activities[0].visibility).toBe("PRIVATE");
    expect(activities[0].summary).toMatchObject({ kind: "BLOCK_COMPLETED", sessionsDone: 4, plannedSessions: 6, weeks: 2 });
    const notifications = await prisma.notification.findMany({ where: { recipientId: USER_ID, type: "PROGRAM_COMPLETED" } });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].activityId).toBe(activities[0].id);
    // The user's own achievement: logged read, keyed once per block.
    expect(notifications[0].readAt).not.toBeNull();
    expect(notifications[0].dedupeKey).toBe(`block:${enrollmentId}`);
  });

  it("offers the series' next block while nothing else runs", async () => {
    const block = await getRecentlyCompletedBlock(USER_ID, now);
    expect(block).toMatchObject({
      enrollmentId,
      programName: "GD Adaptação",
      templateSlug: "gd-adaptacao",
      sessionsDone: 4,
      plannedSessions: 6,
      // Every finished workout of the block: what stays in the history.
      savedWorkouts: 4,
      weeks: 2,
      series: { index: 1, total: 9 },
      next: { slug: "gd-1", name: "GD 1", index: 2, total: 9 },
    });
    // The lift done in the first and the last week: estimated 1RM (Epley) then and now, to the half kilo.
    expect(block?.anchorProgress).toEqual([
      expect.objectContaining({ fromKg: 76, toKg: 82.5 }),
    ]);
    // Two weeks later, it's no longer news.
    expect(await getRecentlyCompletedBlock(USER_ID, new Date(now.getTime() + 15 * DAY_MS))).toBeNull();
  });

  it("repeating the block starts over; a stopped one resumes at its week", async () => {
    expect(await getProgramRestart(USER_ID, programId, now)).toMatchObject({
      resumable: null,
      completed: { enrollmentId },
    });
    const stopped = await prisma.programEnrollment.create({
      data: { userId: USER_ID, programId, status: "ABANDONED", currentWeek: 1, startedAt: monday(1), endedAt: now, programSnapshot: {} },
    });
    await session({ enrollmentId: stopped.id, programWeek: 1, day: 0, at: new Date(monday(1).getTime() + DAY_MS) });
    // Last trained in an earlier calendar week: the next workout starts week 2.
    expect((await getProgramRestart(USER_ID, programId, now)).resumable).toMatchObject({ enrollmentId: stopped.id, week: 2, weeks: 2 });
    await session({ enrollmentId: stopped.id, programWeek: 1, day: 1, at: new Date(now.getTime() - 60_000) });
    // Trained this week: the same week goes on.
    expect((await getProgramRestart(USER_ID, programId, now)).resumable?.week).toBe(1);
  });

  it("the series goes on from the finished block, and the program stopped last is offered back where it was", async () => {
    // The stopped enrollment ended after the finished one.
    await prisma.programEnrollment.updateMany({
      where: { userId: USER_ID, status: "ABANDONED" },
      data: { endedAt: new Date(now.getTime() + 1000) },
    });
    expect(await getSeriesContinuation(USER_ID, now)).toMatchObject({
      finishedGd: ["gd-adaptacao"],
      next: { slug: "gd-1", name: "GD 1", index: 2, total: 9 },
      resume: { programId, programName: "GD Adaptação", templateSlug: "gd-adaptacao", week: 1, weeks: 2 },
    });
  });

  it("isn't offered once another program is running", async () => {
    await prisma.programEnrollment.create({
      data: { userId: USER_ID, programId, status: "ACTIVE", currentWeek: 1, programSnapshot: {} },
    });
    expect(await getRecentlyCompletedBlock(USER_ID, now)).toBeNull();
    // Nor is the stopped one: something runs.
    expect((await getSeriesContinuation(USER_ID, now)).resume).toBeNull();
  });
});

describe("the whole GD plan done", () => {
  it("after GD 8 there's no next block: the plan is done, with the finished GD 8 to repeat", async () => {
    const gd8 = await prisma.workoutTemplate.findUniqueOrThrow({ where: { slug: "gd-8" }, select: { id: true } });
    const program = await prisma.userProgram.create({
      data: { userId: GRADUATE_USER, name: "GD 8", status: "ARCHIVED", daysPerWeek: 5, durationWeeks: 9, sourceTemplateId: gd8.id },
      select: { id: true },
    });
    await prisma.programEnrollment.create({
      data: {
        userId: GRADUATE_USER,
        programId: program.id,
        status: "COMPLETED",
        currentWeek: 9,
        startedAt: monday(9),
        endedAt: new Date(now.getTime() - 15 * DAY_MS),
        programSnapshot: {},
      },
    });
    expect(await getSeriesContinuation(GRADUATE_USER, now)).toMatchObject({
      finishedGd: ["gd-8"],
      next: null,
      done: { slug: "gd-8", programId: program.id },
      resume: null,
    });
    // Before it, no plan is done.
    expect((await getSeriesContinuation(USER_ID, now)).done).toBeNull();
  });
});

describe("recordWorkoutMilestone", () => {
  it("stamps the 10th workout once, privately, and nothing in between", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) {
      const s = await session({
        enrollmentId: null,
        programWeek: null,
        day: 0,
        at: new Date(now.getTime() - (10 - i) * DAY_MS),
        userId: MILESTONE_USER,
      });
      ids.push(s.id);
    }
    expect(await recordWorkoutMilestone(MILESTONE_USER, ids[8])).toBeNull();
    expect(await recordWorkoutMilestone(MILESTONE_USER, ids[9])).toBe(10);
    expect(await recordWorkoutMilestone(MILESTONE_USER, ids[9])).toBeNull();
    const stamps = await prisma.activity.findMany({ where: { userId: MILESTONE_USER, type: "MILESTONE" } });
    expect(stamps).toHaveLength(1);
    expect(stamps[0]).toMatchObject({ visibility: "PRIVATE", sessionId: null });
    expect(stamps[0].summary).toMatchObject({ kind: "WORKOUT_COUNT", count: 10, sessionId: ids[9] });
  });
});

describe("a block activated Thursday–Sunday", () => {
  /** Friday noon (São Paulo) of the week `weeksAgo` weeks back. */
  const friday = (weeksAgo: number) => new Date(monday(weeksAgo).getTime() + 4 * DAY_MS);
  let entryProgramId: string;
  let entryDays: string[];

  beforeAll(async () => {
    const program = await prisma.userProgram.create({
      data: {
        userId: ENTRY_USER,
        name: "Bloco de 2 semanas",
        status: "ACTIVE",
        daysPerWeek: 2,
        durationWeeks: 2,
        days: { create: ["Dia A", "Dia B"].map((name, dayIndex) => ({ name, dayIndex })) },
      },
      include: { days: { orderBy: { dayIndex: "asc" } } },
    });
    entryProgramId = program.id;
    entryDays = program.days.map((d) => d.id);
  });

  const enroll = (p: { status: "ACTIVE" | "ABANDONED"; currentWeek: number; startedAt: Date }) =>
    prisma.programEnrollment.create({
      data: {
        userId: ENTRY_USER,
        programId: entryProgramId,
        status: p.status,
        currentWeek: p.currentWeek,
        startedAt: p.startedAt,
        endedAt: p.status === "ABANDONED" ? now : null,
        programSnapshot: {},
      },
    });
  const workout = (enrollmentId: string, programWeek: number, day: number, at: Date) =>
    prisma.workoutSession.create({
      data: {
        userId: ENTRY_USER,
        enrollmentId,
        programId: entryProgramId,
        programDayId: entryDays[day],
        name: `Dia ${day + 1}`,
        status: "COMPLETED",
        startedAt: new Date(at.getTime() - 3_600_000),
        finishedAt: at,
        totalWorkingSets: 3,
        programWeek,
      },
    });

  it("with no workout in the entry week, ends after its 2nd full week — not a week late", async () => {
    // Activated Friday 3 weeks ago; first trained the Monday after (week 1), then week 2 last week.
    const e = await enroll({ status: "ACTIVE", currentWeek: 2, startedAt: friday(3) });
    await workout(e.id, 1, 0, monday(2));
    await workout(e.id, 1, 1, new Date(monday(2).getTime() + DAY_MS));
    await workout(e.id, 2, 0, monday(1));
    expect(await entryWeekWasTrained(prisma, { id: e.id, userId: ENTRY_USER, startedAt: e.startedAt })).toBe(false);
    expect(await settleFinishedBlock(ENTRY_USER, now)).toBe(true);
    // Both full weeks' workouts count toward the plan (the old rule left week 1's out).
    expect(await describeCompletedBlock(ENTRY_USER, e.id)).toMatchObject({ weeks: 2, sessionsDone: 3, plannedSessions: 4 });
  });

  it("with a workout in the entry week, leaves that week out of the duration", async () => {
    const e = await enroll({ status: "ACTIVE", currentWeek: 2, startedAt: friday(3) });
    await workout(e.id, 1, 0, new Date(friday(3).getTime() + 60_000));
    await workout(e.id, 2, 0, monday(2));
    expect(await entryWeekWasTrained(prisma, { id: e.id, userId: ENTRY_USER, startedAt: e.startedAt })).toBe(true);
    // Entry week + one full week: one full week still to go, whatever the calendar says.
    expect(await settleFinishedBlock(ENTRY_USER, now)).toBe(false);
    await prisma.programEnrollment.update({ where: { id: e.id }, data: { status: "ABANDONED", endedAt: now } });
  });

  it("stopped in its last week, resumes at that week with the counter one step back — and stays open", async () => {
    const e = await enroll({ status: "ABANDONED", currentWeek: 2, startedAt: monday(2) });
    await workout(e.id, 1, 0, monday(2));
    await workout(e.id, 2, 0, monday(1));
    const restart = await getProgramRestart(ENTRY_USER, entryProgramId, now);
    expect(restart.resumable).toMatchObject({ enrollmentId: e.id, week: 2, weeks: 2, currentWeek: 1 });
    // What resumeProgram writes: the calendar must not close it straight away.
    await prisma.programEnrollment.update({
      where: { id: e.id },
      data: { status: "ACTIVE", endedAt: null, currentWeek: restart.resumable?.currentWeek },
    });
    expect(await settleFinishedBlock(ENTRY_USER, now)).toBe(false);
    expect((await prisma.programEnrollment.findUniqueOrThrow({ where: { id: e.id } })).status).toBe("ACTIVE");
  });
});
