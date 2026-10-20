import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { getRecentPersonalRecords } from "./dashboard";
import { getProgressSummary } from "./progress";

/**
 * "Recordes recentes" (Today and Progress) against the real local Postgres: a
 * workout's records all share one timestamp, so which lifts a short list
 * keeps must follow the order they were done in — not the order the
 * database happens to return tied rows in.
 */

const USER = `recent-records-${Date.now()}`;
/** The workout's lifts, in the order they were done (catalog exercises no other test creates or deletes). */
const slugs = [
  "romanian-deadlift",
  "barbell-hip-thrust",
  "leg-press",
  "leg-extensions",
  "lying-leg-curls",
  "side-lateral-raise",
  "calf-press-on-the-leg-press-machine",
  "hack-squat",
  "seated-leg-curl",
  "barbell-bench-press-medium-grip",
];

beforeAll(async () => {
  await prisma.user.create({ data: { id: USER, name: USER, email: `${USER}@fgpower.test`, emailVerified: true } });
  const found = await prisma.exercise.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true } });
  const exercises = slugs.map((slug) => found.find((e) => e.slug === slug)!);
  const finishedAt = new Date(Date.now() - 3_600_000);
  const session = await prisma.workoutSession.create({
    data: {
      userId: USER,
      name: "Sexta — Pernas",
      status: "COMPLETED",
      startedAt: new Date(finishedAt.getTime() - 3_600_000),
      finishedAt,
      totalWorkingSets: exercises.length,
    },
  });
  const sets: string[] = [];
  for (const [i, e] of exercises.entries()) {
    const log = await prisma.workoutExerciseLog.create({
      data: { sessionId: session.id, userId: USER, exerciseId: e.id, sortOrder: i, prescribedSets: 1, repMin: 8, repMax: 12, restSeconds: 90 },
    });
    const set = await prisma.setLog.create({
      data: { userId: USER, sessionId: session.id, exerciseLogId: log.id, exerciseId: e.id, setNumber: 1, weightKg: 50, reps: 10, isCompleted: true },
    });
    sets.push(set.id);
  }
  // Saved last lift first, all at the workout's one timestamp.
  for (const [i, e] of [...exercises.entries()].reverse()) {
    await prisma.exercisePersonalRecord.create({
      data: { userId: USER, exerciseId: e.id, kind: "MAX_WEIGHT", value: 50, weightKg: 50, reps: 10, setLogId: sets[i], sessionId: session.id, achievedAt: finishedAt },
    });
  }
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: USER } });
  await prisma.$disconnect();
});

describe("recent records of one workout", () => {
  it("Today keeps the workout's first lifts, in the order they were done", async () => {
    expect((await getRecentPersonalRecords(USER)).map((r) => r.exercise.slug)).toEqual(slugs.slice(0, 3));
  });

  it("Progress lists 8 of the 10 the same way", async () => {
    const { recentPrs } = await getProgressSummary(USER, "all");
    expect(recentPrs.map((r) => r.slug)).toEqual(slugs.slice(0, 8));
  });
});
