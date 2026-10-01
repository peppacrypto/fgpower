import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { startOfWeek } from "@/lib/training/week";
import { getActiveEnrollment, getLastWeekReview, getTodayHabit } from "./dashboard";
import { getSessionRirTargets } from "./workout-session";

/**
 * Today's habit reads against the real local Postgres, at a fixed "now" (a
 * past Monday), so they hold on any weekday: the week's start after a Sunday
 * catch-up, the schedule following the profile's training days, last week's
 * review (fractional sets, records dated by their workout) and the RIR each
 * exercise aimed for in its program week.
 */

const RUN_ID = `dashboard-${Date.now()}`;
const GD_USER = `${RUN_ID}-gd`;
const ABC_USER = `${RUN_ID}-abc`;
const DAY_MS = 86_400_000;
/** Monday noon (São Paulo) of the current calendar week: "now" for every read here. */
const NOW = new Date(startOfWeek(new Date()).getTime() + 12 * 3_600_000);
/** 18:00 São Paulo, `day` days after the Monday `weeksAgo` weeks before NOW's. */
const at = (weeksAgo: number, day: number) => new Date(startOfWeek(NOW).getTime() - weeksAgo * 7 * DAY_MS + day * DAY_MS + 18 * 3_600_000);

const GD_DAYS = ["Segunda — Superior", "Terça — Inferior", "Quarta — Peito", "Quinta — Puxar", "Sexta — Pernas"];
let gd: { programId: string; enrollmentId: string; dayIds: string[] };
let bench: string;
let legExtension: string;

async function workout(p: { day: number; at: Date; programWeek: number; sets?: { exerciseId: string; count: number }[] }) {
  const s = await prisma.workoutSession.create({
    data: {
      userId: GD_USER,
      enrollmentId: gd.enrollmentId,
      programId: gd.programId,
      programDayId: gd.dayIds[p.day],
      name: GD_DAYS[p.day],
      status: "COMPLETED",
      startedAt: new Date(p.at.getTime() - 3_600_000),
      finishedAt: p.at,
      totalWorkingSets: 3,
      programWeek: p.programWeek,
    },
  });
  for (const [i, lift] of (p.sets ?? []).entries()) {
    const log = await prisma.workoutExerciseLog.create({
      data: { sessionId: s.id, userId: GD_USER, exerciseId: lift.exerciseId, sortOrder: i, prescribedSets: 3, repMin: 8, repMax: 12, restSeconds: 90 },
    });
    for (let n = 1; n <= lift.count; n++) {
      await prisma.setLog.create({
        data: { userId: GD_USER, sessionId: s.id, exerciseLogId: log.id, exerciseId: lift.exerciseId, setNumber: n, weightKg: 60, reps: 8, isCompleted: true },
      });
    }
  }
  return s.id;
}

beforeAll(async () => {
  for (const id of [GD_USER, ABC_USER]) {
    await prisma.user.create({ data: { id, name: id, email: `${id}@fgpower.test`, emailVerified: true } });
  }
  await prisma.profile.create({ data: { userId: GD_USER, displayName: "GD", daysPerWeek: 5, preferredDays: [] } });
  await prisma.profile.create({ data: { userId: ABC_USER, displayName: "ABC", daysPerWeek: 3, preferredDays: [2, 4, 6] } });
  bench = (await prisma.exercise.findUniqueOrThrow({ where: { slug: "barbell-bench-press-medium-grip" } })).id;
  legExtension = (await prisma.exercise.findUniqueOrThrow({ where: { slug: "leg-extensions" } })).id;
  const template = await prisma.workoutTemplate.findUniqueOrThrow({ where: { slug: "gd-1" }, select: { id: true, weeklyGuidance: true } });

  const program = await prisma.userProgram.create({
    data: {
      userId: GD_USER,
      name: "GD 1",
      status: "ACTIVE",
      daysPerWeek: 5,
      durationWeeks: 13,
      sourceTemplateId: template.id,
      weeklyGuidance: template.weeklyGuidance ?? [],
      days: {
        create: GD_DAYS.map((name, dayIndex) => ({
          name,
          dayIndex,
          exercises: {
            create: [
              { exerciseId: bench, sortOrder: 0, rirTarget: 3, notes: "Use as travas; nunca à falha (mín. RIR 2)." },
              { exerciseId: legExtension, sortOrder: 1, rirTarget: 2 },
            ],
          },
        })),
      },
    },
    include: { days: { orderBy: { dayIndex: "asc" } } },
  });
  // Started on a Monday four weeks back (no entry week); on its first day after last week's Sunday catch-up.
  const enrollment = await prisma.programEnrollment.create({
    data: { userId: GD_USER, programId: program.id, status: "ACTIVE", currentWeek: 4, nextDayIndex: 1, startedAt: at(4, 0), programSnapshot: {} },
  });
  gd = { programId: program.id, enrollmentId: enrollment.id, dayIds: program.days.map((d) => d.id) };
  // Three full weeks, then last week only Segunda, on Sunday.
  for (let w = 4; w >= 2; w--) for (let d = 0; d < 5; d++) await workout({ day: d, at: at(w, d), programWeek: 5 - w });
  const sunday = await workout({
    day: 0,
    at: at(1, 6),
    programWeek: 4,
    sets: [
      { exerciseId: bench, count: 3 },
      { exerciseId: legExtension, count: 5 },
    ],
  });
  // Records of last week's workout saved this week (a workout left open, saved on its own day).
  await prisma.exercisePersonalRecord.create({
    data: { userId: GD_USER, exerciseId: bench, kind: "MAX_WEIGHT", value: 60, weightKg: 60, reps: 8, sessionId: sunday, achievedAt: new Date(NOW.getTime() - 60_000) },
  });

  // A Sessão A/B/C plan laid out on Monday/Wednesday/Friday at activation.
  const abc = await prisma.userProgram.create({
    data: {
      userId: ABC_USER,
      name: "ABC",
      status: "ACTIVE",
      daysPerWeek: 3,
      days: { create: ["Sessão A", "Sessão B", "Sessão C"].map((name, dayIndex) => ({ name, dayIndex, weekday: [1, 3, 5][dayIndex] })) },
    },
  });
  await prisma.programEnrollment.create({
    data: { userId: ABC_USER, programId: abc.id, status: "ACTIVE", startedAt: at(2, 0), programSnapshot: {} },
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [GD_USER, ABC_USER] } } });
  await prisma.$disconnect();
});

describe("Today's week start (W-089)", () => {
  it("after Segunda on Sunday, Monday continues at Terça — never the same heavy day twice in a row", async () => {
    const enrollment = await getActiveEnrollment(GD_USER);
    const habit = await getTodayHabit(GD_USER, enrollment, NOW);
    expect(habit.program?.weekStart).toMatchObject({ byDefault: "continue", afterEntryWeek: false });
    expect(habit.program?.weekStart?.leftover.map((d) => d.name)).toEqual(GD_DAYS.slice(1));
  });

  it("promises next week the same way on the Sunday itself (Today's and the summary's date)", async () => {
    const enrollment = await getActiveEnrollment(GD_USER);
    const sundayNight = new Date(at(1, 6).getTime() + 3_600_000);
    const habit = await getTodayHabit(GD_USER, enrollment, sundayNight);
    expect(habit.program?.nextWeekCarryOver).toBe(true);
  });
});

describe("the schedule follows the training days", () => {
  it("a plan's weekdays come from the profile's days now, not the ones written at activation", async () => {
    const enrollment = await getActiveEnrollment(ABC_USER);
    expect(enrollment?.program.days.map((d) => d.weekday)).toEqual([2, 4, 6]);
    await prisma.profile.update({ where: { userId: ABC_USER }, data: { preferredDays: [1, 3, 5] } });
    expect((await getActiveEnrollment(ABC_USER))?.program.days.map((d) => d.weekday)).toEqual([1, 3, 5]);
  });
});

describe("last week's review (W-129)", () => {
  it("counts fractional sets per muscle and flags 'low' only where the muscle has direct work", async () => {
    const review = await getLastWeekReview(GD_USER, NOW);
    const muscle = (name: string) => review.muscles.find((m) => m.name === name);
    // 3 bench sets: chest direct; shoulders and triceps half credit.
    expect(muscle("Peitoral")).toMatchObject({ sets: 3, direct: 3, low: true, high: false });
    expect(muscle("Tríceps")).toMatchObject({ sets: 1.5, direct: 0, low: false });
    expect(muscle("Quadríceps")).toMatchObject({ sets: 5, direct: 5, low: false });
    expect(review.muscles[0].name).toBe("Quadríceps");
  });

  it("dates records by their workout, not by when they were saved", async () => {
    const review = await getLastWeekReview(GD_USER, NOW);
    expect(review.recordExercises.map((e) => e.slug)).toEqual(["barbell-bench-press-medium-grip"]);
    const nextWeek = await getLastWeekReview(GD_USER, new Date(NOW.getTime() + 7 * DAY_MS));
    expect(nextWeek.recordExercises).toEqual([]);
  });
});

describe("the RIR each exercise aimed for (W-054)", () => {
  it("a finished workout reads its own program week: GD 1 week 5 keeps the bench at RIR 2", async () => {
    const week5 = await workout({
      day: 0,
      at: new Date(NOW.getTime() - 3_600_000),
      programWeek: 5,
      sets: [
        { exerciseId: bench, count: 1 },
        { exerciseId: legExtension, count: 1 },
      ],
    });
    const logs = await prisma.workoutExerciseLog.findMany({ where: { sessionId: week5 }, orderBy: { sortOrder: "asc" } });
    // The logs as a workout start writes them: the program exercise's target and notes.
    await prisma.workoutExerciseLog.update({ where: { id: logs[0].id }, data: { rirTarget: 3, notes: "nunca à falha (mín. RIR 2)" } });
    await prisma.workoutExerciseLog.update({ where: { id: logs[1].id }, data: { rirTarget: 2 } });
    const targets = await getSessionRirTargets(GD_USER, week5);
    expect(targets.get(logs[0].id)).toBe(2);
    // A machine isolation follows the wave down to RIR 1.
    expect(targets.get(logs[1].id)).toBe(1);
  });
});

describe("stretches and cardio aren't training volume (L-volume-counts-stretches)", () => {
  it("a stretch done last week is absent from last week's muscles", async () => {
    const stretch = (await prisma.exercise.findUniqueOrThrow({ where: { slug: "all-fours-quad-stretch" } })).id;
    const before = await getLastWeekReview(GD_USER, NOW);
    await workout({ day: 1, at: at(1, 3), programWeek: 4, sets: [{ exerciseId: stretch, count: 6 }] });
    const after = await getLastWeekReview(GD_USER, NOW);
    expect(after.muscles).toEqual(before.muscles);
    expect(after.muscles.find((m) => m.name === "Quadríceps")).toMatchObject({ sets: 5, direct: 5 });
  });
});
