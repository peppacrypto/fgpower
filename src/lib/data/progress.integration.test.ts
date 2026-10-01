import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { dayNumberOf, mondayOf } from "@/lib/training/day-rotation";
import { startOfWeek } from "@/lib/training/week";
import { getMuscleWeeks, getWeekRows } from "./progress";

/**
 * Progress's trends (W-085) against the real local Postgres: sets per muscle
 * group per São Paulo week — a set once per group, direct 1 and assisting
 * 0.5, warm-ups, unfinished sets and stretches left out, a Sunday-night
 * workout in its own week — and the days trained in each week.
 */

const RUN_ID = `trends-${Date.now()}`;
const USER_ID = `${RUN_ID}-u`;
const DAY_MS = 86_400_000;
const HOUR = 3_600_000;
/** Monday 00:00 São Paulo of the week before this one. */
const LAST_MONDAY = new Date(startOfWeek(new Date()).getTime() - 7 * DAY_MS);

async function exerciseWith(muscles: { muscleId: string; role: "PRIMARY" | "SECONDARY" }[]) {
  // A real exercise with exactly these muscles (Batch 5 test data: never published).
  const slug = `${RUN_ID}-${muscles.map((m) => m.muscleId).join("-")}`;
  return prisma.exercise.create({
    data: {
      slug,
      nameEn: slug,
      namePt: slug,
      category: "STRENGTH",
      isPublished: false,
      muscles: { create: muscles },
    },
  });
}

async function workout(at: Date, sets: { exerciseId: string; setType?: "WARMUP" | "WORKING"; done?: boolean }[]) {
  const s = await prisma.workoutSession.create({
    data: { userId: USER_ID, name: "Treino", status: "COMPLETED", startedAt: new Date(at.getTime() - HOUR), finishedAt: at, totalWorkingSets: sets.length },
  });
  for (const [i, set] of sets.entries()) {
    const log = await prisma.workoutExerciseLog.create({
      data: { sessionId: s.id, userId: USER_ID, exerciseId: set.exerciseId, sortOrder: i, prescribedSets: 1, repMin: 8, repMax: 12, restSeconds: 90 },
    });
    await prisma.setLog.create({
      data: {
        userId: USER_ID,
        sessionId: s.id,
        exerciseLogId: log.id,
        exerciseId: set.exerciseId,
        setNumber: 1,
        setType: set.setType ?? "WORKING",
        weightKg: 50,
        reps: 10,
        isCompleted: set.done !== false,
      },
    });
  }
}

let chestPress: string;
let row: string;
let stretch: string;

beforeAll(async () => {
  await prisma.user.create({ data: { id: USER_ID, name: USER_ID, email: `${USER_ID}@fgpower.test`, emailVerified: true } });
  await prisma.profile.create({ data: { userId: USER_ID, displayName: "Teste", daysPerWeek: 3 } });
  chestPress = (
    await exerciseWith([
      { muscleId: "chest", role: "PRIMARY" },
      { muscleId: "triceps", role: "SECONDARY" },
    ])
  ).id;
  // Primary in two muscles of "Costas": one set counts once.
  row = (
    await exerciseWith([
      { muscleId: "lats", role: "PRIMARY" },
      { muscleId: "middle-back", role: "PRIMARY" },
    ])
  ).id;
  stretch = (await prisma.exercise.findUniqueOrThrow({ where: { slug: "all-fours-quad-stretch" } })).id;

  // Last week, Tuesday 18:00: a chest set, a row set, a warm-up, an unfinished set and a stretch.
  await workout(new Date(LAST_MONDAY.getTime() + DAY_MS + 18 * HOUR), [
    { exerciseId: chestPress },
    { exerciseId: row },
    { exerciseId: chestPress, setType: "WARMUP" },
    { exerciseId: chestPress, done: false },
    { exerciseId: stretch },
  ]);
  // Last week's Sunday at 22:30 São Paulo (01:30 UTC on Monday): still last week.
  await workout(new Date(LAST_MONDAY.getTime() + 6 * DAY_MS + 22.5 * HOUR), [{ exerciseId: chestPress }]);
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: USER_ID } });
  await prisma.exercise.deleteMany({ where: { slug: { startsWith: RUN_ID } } });
  await prisma.$disconnect();
});

describe("getMuscleWeeks", () => {
  it("counts direct sets once per group and assisting ones at half, in São Paulo weeks", async () => {
    const rows = await getMuscleWeeks(USER_ID, new Date(LAST_MONDAY.getTime() - DAY_MS));
    const monday = mondayOf(dayNumberOf(LAST_MONDAY));
    const of = (key: string) => rows.find((r) => r.key === key && r.monday === monday);
    // Two chest sets (Tuesday and the Sunday-night one), no warm-up or unfinished set.
    expect(of("peito")).toMatchObject({ sets: 2, direct: 2 });
    expect(of("triceps")).toMatchObject({ sets: 1, direct: 0 });
    // Lats and middle back are both "Costas": 1, not 2.
    expect(of("costas")).toMatchObject({ sets: 1, direct: 1 });
    // The stretch counts nowhere.
    expect(of("quadriceps")).toBeUndefined();
    expect(rows.every((r) => r.monday === monday)).toBe(true);
  });
});

describe("getWeekRows", () => {
  it("lists each week's trained days, Monday first", async () => {
    const rows = await getWeekRows(USER_ID);
    const last = rows.find((r) => r.monday === mondayOf(dayNumberOf(LAST_MONDAY)));
    expect(last?.days).toEqual([1, 6]);
    expect(rows[rows.length - 1]).toMatchObject({ current: true, days: [] });
  });
});
