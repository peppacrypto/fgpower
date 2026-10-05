import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { lastFinishedWorkoutBefore } from "@/lib/data/workout-session";
import { WELCOME_BACK_AFTER_DAYS } from "@/lib/data/dashboard";
import { spDaysBetween } from "@/lib/training/stale";

/**
 * A-006 / A-017: "ease-back" (return from a break, ~90% + RIR+1) must be a
 * WHOLE-PROGRAM layoff, not a single lift's reference age. A deload week (or a
 * rotating program where a lift recurs > 10 days apart) still has the user
 * training within the window, so the week after must resume at the pre-deload
 * load (A-017), NOT ease back. lastFinishedWorkoutBefore is that signal — the
 * user's most recent finished workout, regardless of which lift.
 */

const RUN = `lastwo-${Date.now()}`;
const U_RECENT = `${RUN}-recent`;
const U_LAYOFF = `${RUN}-layoff`;
const U_NONE = `${RUN}-none`;
const ALL = [U_RECENT, U_LAYOFF, U_NONE];
const DAY_MS = 86_400_000;
const now = new Date();

async function mkUser(id: string) {
  await prisma.user.create({ data: { id, name: id, email: `${id}@fgpower.test`, emailVerified: true } });
}

async function finishedWorkout(userId: string, daysAgo: number) {
  const at = new Date(now.getTime() - daysAgo * DAY_MS);
  await prisma.workoutSession.create({
    data: {
      userId,
      name: "W",
      status: "COMPLETED",
      startedAt: new Date(at.getTime() - 3_600_000),
      finishedAt: at,
    },
  });
}

/** The exact decision both call sites make (page.tsx + summary-data.ts). */
const easeBackFor = (last: { finishedAt: Date } | null) =>
  last != null && spDaysBetween(last.finishedAt, now) >= WELCOME_BACK_AFTER_DAYS;

beforeAll(async () => {
  await Promise.all(ALL.map(mkUser));
  await finishedWorkout(U_RECENT, 25); // an older one…
  await finishedWorkout(U_RECENT, 5); // …but trained again 5 days ago (e.g. last week / a deload week)
  await finishedWorkout(U_LAYOFF, 15); // last trained 15 days ago — a real break
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: ALL } } });
  await prisma.$disconnect();
});

describe("ease-back is a whole-program layoff, not a per-lift gap (A-006 / A-017)", () => {
  it("picks the most recent finished workout before the cutoff", async () => {
    const last = await lastFinishedWorkoutBefore(U_RECENT, now);
    expect(last).not.toBeNull();
    // The 5-day-ago one, not the 25-day-ago one.
    expect(spDaysBetween(last!.finishedAt, now)).toBeLessThan(WELCOME_BACK_AFTER_DAYS);
  });

  it("no ease-back when the user trained within the window (a deload/normal week) — A-017 resumes", async () => {
    expect(easeBackFor(await lastFinishedWorkoutBefore(U_RECENT, now))).toBe(false);
  });

  it("ease-back after a real 10+ day layoff", async () => {
    expect(easeBackFor(await lastFinishedWorkoutBefore(U_LAYOFF, now))).toBe(true);
  });

  it("no ease-back for a first-ever workout (no prior finished workout)", async () => {
    expect(await lastFinishedWorkoutBefore(U_NONE, now)).toBeNull();
    expect(easeBackFor(await lastFinishedWorkoutBefore(U_NONE, now))).toBe(false);
  });
});
