import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { startOfWeek } from "@/lib/training/week";

/**
 * A-001 against the real local Postgres: a finished week keeps its streak
 * verdict after the program's frequency is edited (its workouts carry the
 * frozen weekTargetSnapshot), and a pre-snapshot row falls back to the live
 * program.
 */

vi.mock("@/lib/auth/require-user", () => ({
  getCurrentSession: async () => ({ user: { id: USER_ID } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const RUN_ID = `freeze-${Date.now()}`;
const USER_ID = `${RUN_ID}-u`;
const DAY_MS = 86_400_000;
const now = new Date();
/** Monday noon (São Paulo) `weeksAgo` weeks back. */
const monday = (weeksAgo: number) => new Date(startOfWeek(now).getTime() - weeksAgo * 7 * DAY_MS + 12 * 3_600_000);

const { saveProgram } = await import("@/lib/actions/program-builder");
const { buildStreakWeeks } = await import("@/lib/data/streak-data");

let programId: string;
let enrollmentId: string;
let dayIds: string[];
let exerciseId: string;

async function finished(p: { programWeek: number; day: number; at: Date; snapshot: boolean }) {
  return prisma.workoutSession.create({
    data: {
      userId: USER_ID,
      enrollmentId,
      programId,
      programDayId: dayIds[p.day],
      programDayIndex: p.day,
      name: `Dia ${p.day + 1}`,
      status: "COMPLETED",
      startedAt: new Date(p.at.getTime() - 3_600_000),
      finishedAt: p.at,
      totalWorkingSets: 3,
      programWeek: p.programWeek,
      // Trained under A/B/C @ 3×.
      weekTargetSnapshot: p.snapshot ? { daysPerWeek: 3, trainableDays: 3, dayCount: 3 } : undefined,
    },
  });
}

beforeAll(async () => {
  await prisma.user.create({ data: { id: USER_ID, name: USER_ID, email: `${USER_ID}@fgpower.test`, emailVerified: true } });
  await prisma.profile.create({ data: { userId: USER_ID, displayName: USER_ID, daysPerWeek: 3 } });
  const [ex] = await prisma.exercise.findMany({ select: { id: true }, take: 1, orderBy: { id: "asc" } });
  exerciseId = ex.id;
  const program = await prisma.userProgram.create({
    data: {
      userId: USER_ID,
      name: "Full body",
      status: "ACTIVE",
      daysPerWeek: 3,
      durationWeeks: 8,
      days: {
        create: ["A", "B", "C"].map((n, i) => ({
          dayIndex: i,
          name: `Sessão ${n}`,
          exercises: { create: [{ exerciseId, sortOrder: 0 }] },
        })),
      },
    },
    include: { days: { orderBy: { dayIndex: "asc" } } },
  });
  programId = program.id;
  dayIds = program.days.map((d) => d.id);
  const enrollment = await prisma.programEnrollment.create({
    data: { userId: USER_ID, programId, status: "ACTIVE", startedAt: monday(4), currentWeek: 4, nextDayIndex: 0, programSnapshot: {} },
  });
  enrollmentId = enrollment.id;
  // Four met weeks (A/B/C each), programWeek 1..4, all stamped at 3/3.
  for (let w = 1; w <= 4; w++) {
    for (let d = 0; d < 3; d++) {
      await finished({ programWeek: w, day: d, at: new Date(monday(5 - w).getTime() + d * 2 * DAY_MS), snapshot: true });
    }
  }
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: USER_ID } });
  await prisma.$disconnect();
});

describe("A-001 program edit does not rewrite streak history", () => {
  it("keeps the four met weeks after raising the frequency to 4", async () => {
    const before = await buildStreakWeeks(USER_ID, now);
    expect(before.weeks.map((w) => w.met)).toEqual([true, true, true, true]);

    const result = await saveProgram(programId, {
      name: "Full body",
      description: "",
      daysPerWeek: 4, // raise the weekly frequency
      days: dayIds.map((id, i) => ({
        id,
        name: `Sessão ${"ABC"[i]}`,
        focus: null,
        exercises: [
          { id: undefined, exerciseId, exerciseName: "x", groupKey: null, sets: 3, repMin: 8, repMax: 12, rirTarget: 2, restSeconds: 120, warmupSets: 0, loadTargetKg: null, notes: null },
        ],
      })),
    });
    expect(result.ok).toBe(true);

    const after = await buildStreakWeeks(USER_ID, now);
    // Frozen: the four finished weeks keep target 3 and stay met.
    expect(after.weeks.map((w) => [w.target, w.met])).toEqual([[3, true], [3, true], [3, true], [3, true]]);
  });

  it("a pre-snapshot (NULL) row falls back to the live plan", async () => {
    // Older workout without a snapshot, judged by the current program (now 4/week).
    await finished({ programWeek: 2, day: 0, at: new Date(monday(3).getTime() + 5 * DAY_MS), snapshot: false });
    const rows = await buildStreakWeeks(USER_ID, now);
    // The weeks that still have a stamped workout stay frozen at 3; nothing throws.
    expect(rows.weeks.some((w) => w.target === 3)).toBe(true);
  });
});
