import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { checkAndRecordPersonalRecords } from "./personal-records";

/**
 * checkAndRecordPersonalRecords against the real local Postgres: the first
 * log is a baseline, records are measured against OTHER COMPLETED sessions
 * finished before it only (not this session's own sets, not discarded or
 * in-progress ones, not later workouts), and a rerun doesn't duplicate.
 */

const RUN_ID = `prs-${Date.now()}`;
const USER_ID = `${RUN_ID}-user`;
let exerciseId: string;
let t = Date.now() - 30 * 86400_000;

async function session(
  status: "COMPLETED" | "DISCARDED" | "IN_PROGRESS",
  loads: [number, number][],
  finishedAt: Date = new Date(t + 86400_000 + 3600_000),
) {
  t += 86400_000;
  const s = await prisma.workoutSession.create({
    data: {
      userId: USER_ID,
      name: "Dia A",
      status,
      startedAt: new Date(finishedAt.getTime() - 3600_000),
      finishedAt: status === "COMPLETED" ? finishedAt : null,
    },
  });
  const log = await prisma.workoutExerciseLog.create({
    data: {
      sessionId: s.id,
      userId: USER_ID,
      exerciseId,
      sortOrder: 0,
      prescribedSets: loads.length,
      repMin: 8,
      repMax: 12,
      restSeconds: 90,
    },
  });
  await prisma.setLog.createMany({
    data: loads.map(([weightKg, reps], i) => ({
      userId: USER_ID,
      sessionId: s.id,
      exerciseLogId: log.id,
      exerciseId,
      setNumber: i + 1,
      setType: "WORKING" as const,
      weightKg,
      reps,
      isCompleted: true,
      completedAt: new Date(t + i * 60_000),
    })),
  });
  return s.id;
}

const records = (sessionId: string) =>
  prisma.exercisePersonalRecord.findMany({
    where: { userId: USER_ID, sessionId },
    select: { kind: true, value: true, weightKg: true, reps: true },
    orderBy: { kind: "asc" },
  });

beforeAll(async () => {
  await prisma.user.create({ data: { id: USER_ID, name: USER_ID, email: `${USER_ID}@fgpower.test`, emailVerified: true } });
  exerciseId = (await prisma.exercise.findFirstOrThrow({ select: { id: true } })).id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: USER_ID } });
  await prisma.$disconnect();
});

describe("checkAndRecordPersonalRecords", () => {
  it("the first completed log is a baseline: no records, the exercise is reported", async () => {
    const first = await session("COMPLETED", [[60, 12], [60, 11], [60, 10]]);
    expect(await checkAndRecordPersonalRecords(USER_ID, first)).toEqual([exerciseId]);
    expect(await records(first)).toEqual([]);
  });

  it("tied straight sets beat the old best, ignoring discarded and in-progress workouts", async () => {
    // Neither of these counts as history, however many reps they hold.
    await session("DISCARDED", [[60, 20]]);
    await session("IN_PROGRESS", [[60, 20]]);
    const second = await session("COMPLETED", [[60, 12], [60, 13], [60, 13], [60, 12]]);
    expect(await checkAndRecordPersonalRecords(USER_ID, second)).toEqual([]);
    expect(await records(second)).toEqual([{ kind: "MAX_REPS_AT_WEIGHT", value: 13, weightKg: 60, reps: 13 }]);
  });

  it("is idempotent", async () => {
    const third = await session("COMPLETED", [[62.5, 10], [62.5, 9]]);
    await checkAndRecordPersonalRecords(USER_ID, third);
    await checkAndRecordPersonalRecords(USER_ID, third);
    const rows = await records(third);
    expect(rows.map((r) => r.kind).sort()).toEqual(["ESTIMATED_1RM", "MAX_WEIGHT"]);
    expect(rows.find((r) => r.kind === "MAX_WEIGHT")).toMatchObject({ value: 62.5, reps: 10 });
    // No session-volume records any more.
    expect(await prisma.exercisePersonalRecord.count({ where: { userId: USER_ID, kind: "SESSION_VOLUME" } })).toBe(0);
  });

  it("a workout saved later with an earlier date is judged against its own past only", async () => {
    // Trained after it but saved first: 70 × 12.
    const later = await session("COMPLETED", [[70, 12]]);
    const laterFinishedAt = (await prisma.workoutSession.findUniqueOrThrow({ where: { id: later }, select: { finishedAt: true } }))
      .finishedAt as Date;
    await checkAndRecordPersonalRecords(USER_ID, later);
    // "Salvar como feito em dd/mm": finished half a day before `later`.
    const stale = await session("COMPLETED", [[65, 10]], new Date(laterFinishedAt.getTime() - 12 * 3600_000));
    expect(await checkAndRecordPersonalRecords(USER_ID, stale)).toEqual([]);
    const rows = await records(stale);
    expect(rows.find((r) => r.kind === "MAX_WEIGHT")).toMatchObject({ value: 65, reps: 10 });
  });
});
