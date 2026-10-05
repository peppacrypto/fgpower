import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { startOfWeek } from "@/lib/training/week";
import { getProgramRestart, getRecentlyCompletedBlock } from "@/lib/data/program-lifecycle";

/**
 * Batch 5 — enrollment / block lifecycle & re-entry against the real local
 * Postgres:
 *  - A-024: shrinking "Duração" at/under the trained weeks ends the block as a
 *    RESUMABLE (ABANDONED, flagged) block, not a false completion; unconfirmed
 *    shrinks are ignored.
 *  - A-027: a later block (an enrollment started after this one ended) hides the
 *    stale "Bloco concluído" hero (getRecentlyCompletedBlock returns null).
 *  - A-028: the undo of "Recomeçar"/"Repetir" drops the empty shadow enrollment
 *    and keeps the real stopped/finished one resumable.
 * (A-026 lives in workouts.integration.)
 */

const RUN = `b5-${Date.now()}`;

// This suite acts as several users (each RUN-prefixed), so the auth mock returns
// a mutable "current" user that each test sets before it calls an action — the
// signedIn/current pattern of the sibling integration tests (deload-planned,
// admin). saveProgram reads getCurrentSession().user.id; restorePreviousProgram
// reads requireUserOrThrow().id and ends in redirect() + revalidatePath().
let current: string | null = null;
vi.mock("@/lib/auth/require-user", () => ({
  requireUserOrThrow: async () => {
    if (!current) throw new Error("UNAUTHORIZED");
    return { id: current };
  },
  getCurrentSession: async () => (current ? { user: { id: current } } : null),
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

const { saveProgram } = await import("@/lib/actions/program-builder");
const { restorePreviousProgram } = await import("@/lib/actions/programs");

const DAY_MS = 86_400_000;
const now = new Date();
const monday = (weeksAgo: number) => new Date(startOfWeek(now).getTime() - weeksAgo * 7 * DAY_MS + 12 * 3_600_000);

let exerciseId: string;

async function mkUser(id: string) {
  await prisma.user.create({ data: { id, name: id, email: `${id}@fgpower.test`, emailVerified: true } });
  await prisma.profile.create({ data: { userId: id, displayName: id, daysPerWeek: 3, preferredDays: [1, 3, 5] } });
}

/** A 13-week, 3-day program owned by `userId`, ACTIVE, with one enrollment at `currentWeek`. */
async function mkRunning(userId: string, currentWeek: number, startedAt: Date) {
  const program = await prisma.userProgram.create({
    data: {
      userId,
      name: "Bloco 13",
      status: "ACTIVE",
      daysPerWeek: 3,
      durationWeeks: 13,
      days: { create: ["A", "B", "C"].map((name, dayIndex) => ({ name, dayIndex })) },
    },
    include: { days: { orderBy: { dayIndex: "asc" } } },
  });
  const enrollment = await prisma.programEnrollment.create({
    data: { userId, programId: program.id, status: "ACTIVE", currentWeek, startedAt, programSnapshot: {} },
  });
  return { program, enrollment, dayIds: program.days.map((d) => d.id) };
}

/** One finished working set in a session of `enrollmentId`, dated `at`, week `programWeek`. */
async function session(userId: string, programId: string, enrollmentId: string, dayId: string, programWeek: number, at: Date) {
  const s = await prisma.workoutSession.create({
    data: {
      userId,
      programId,
      enrollmentId,
      programDayId: dayId,
      name: "treino",
      status: "COMPLETED",
      startedAt: new Date(at.getTime() - 3_600_000),
      finishedAt: at,
      totalWorkingSets: 3,
      programWeek,
    },
    select: { id: true },
  });
  const log = await prisma.workoutExerciseLog.create({
    data: { sessionId: s.id, userId, exerciseId, sortOrder: 0, prescribedSets: 3, repMin: 8, repMax: 12, restSeconds: 90 },
  });
  await prisma.setLog.create({
    data: { userId, sessionId: s.id, exerciseLogId: log.id, exerciseId, setNumber: 1, weightKg: 50, reps: 8, isCompleted: true },
  });
  return s.id;
}

beforeAll(async () => {
  exerciseId = (await prisma.exercise.findFirstOrThrow({ select: { id: true }, orderBy: { id: "asc" } })).id;
});

afterAll(async () => {
  // Users cascade to programs, enrollments, sessions.
  await prisma.user.deleteMany({ where: { email: { endsWith: "@fgpower.test" }, id: { startsWith: RUN } } });
});

describe("A-024 · shortening Duração", () => {
  it("ends the running block as a RESUMABLE stopped block when confirmed (no false completion)", async () => {
    const userId = `${RUN}-u1`;
    await mkUser(userId);
    // Trained weeks 1–4 (currentWeek counter 4), activated a Monday (no entry week).
    const { program, enrollment, dayIds } = await mkRunning(userId, 4, monday(4));
    for (let w = 1; w <= 4; w++) await session(userId, program.id, enrollment.id, dayIds[0], w, monday(4 - (w - 1)));

    // The builder saves Duração 4 (≤ 4 trained) with the confirm flag.
    current = userId;
    const res = await saveProgram(program.id, {
      name: "Bloco 13",
      description: "",
      daysPerWeek: 3,
      durationWeeks: 4,
      confirmShortenDuration: true,
      days: [0, 1, 2].map((i) => ({
        id: dayIds[i],
        name: ["A", "B", "C"][i],
        focus: null,
        exercises: [{ exerciseId, groupKey: null, sets: 3, repMin: 8, repMax: 12, rirTarget: null, restSeconds: 90, warmupSets: 0, loadTargetKg: null, notes: null }],
      })),
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.blockEnded).toBe(true);

    const e = await prisma.programEnrollment.findUniqueOrThrow({ where: { id: enrollment.id } });
    expect(e.status).toBe("ABANDONED");
    expect(e.endedByDurationEdit).toBe(true);
    const prog = await prisma.userProgram.findUniqueOrThrow({ where: { id: program.id } });
    expect(prog.status).toBe("ARCHIVED");
    // No false completion was recorded.
    const completedActivity = await prisma.activity.findFirst({ where: { userId, type: "PROGRAM_COMPLETED" } });
    expect(completedActivity).toBeNull();
    // Re-entry offers "Retomar", flagged.
    const restart = await getProgramRestart(userId, program.id, now);
    expect(restart.completed).toBeNull();
    expect(restart.resumable?.endedByDurationEdit).toBe(true);
    expect(restart.resumable?.week).toBe(4);
  });

  it("ignores an unconfirmed shrink that would end the block (duration unchanged, still ACTIVE)", async () => {
    const userId = `${RUN}-u2`;
    await mkUser(userId);
    const { program, enrollment, dayIds } = await mkRunning(userId, 4, monday(4));
    for (let w = 1; w <= 4; w++) await session(userId, program.id, enrollment.id, dayIds[0], w, monday(4 - (w - 1)));

    current = userId;
    const res = await saveProgram(program.id, {
      name: "Bloco 13",
      description: "",
      daysPerWeek: 3,
      durationWeeks: 4, // ≤ 4 trained, but no confirm flag
      days: [0, 1, 2].map((i) => ({
        id: dayIds[i],
        name: ["A", "B", "C"][i],
        focus: null,
        exercises: [{ exerciseId, groupKey: null, sets: 3, repMin: 8, repMax: 12, rirTarget: null, restSeconds: 90, warmupSets: 0, loadTargetKg: null, notes: null }],
      })),
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.blockEnded).toBe(false);
      expect(res.durationWeeks).toBe(13); // kept — the shrink was ignored
    }
    const e = await prisma.programEnrollment.findUniqueOrThrow({ where: { id: enrollment.id } });
    expect(e.status).toBe("ACTIVE");
  });
});

describe("A-028 · undo of Repetir/Recomeçar keeps the stopped block resumable", () => {
  it("drops the empty shadow enrollment so Retomar survives the undo", async () => {
    const userId = `${RUN}-u3`;
    await mkUser(userId);
    // Program trained to week 4 then stopped (archived): one ABANDONED enrollment with 4 weeks.
    const { program, dayIds } = await mkRunning(userId, 4, monday(6));
    const original = await prisma.programEnrollment.findFirstOrThrow({ where: { programId: program.id } });
    for (let w = 1; w <= 4; w++) await session(userId, program.id, original.id, dayIds[0], w, monday(6 - (w - 1)));
    await prisma.programEnrollment.update({ where: { id: original.id }, data: { status: "ABANDONED", endedAt: monday(2) } });
    await prisma.userProgram.update({ where: { id: program.id }, data: { status: "ARCHIVED", archivedAt: monday(2) } });

    // "Recomeçar": a fresh ACTIVE week-1 enrollment of the SAME program (what
    // startProgram would create); it has no finished workout of its own.
    const shadow = await prisma.programEnrollment.create({
      data: {
        userId,
        programId: program.id,
        status: "ACTIVE",
        currentWeek: 1,
        startedAt: new Date(now.getTime() - 60_000),
        endedAt: null,
        programSnapshot: {},
      },
    });
    await prisma.userProgram.update({ where: { id: program.id }, data: { status: "ACTIVE", archivedAt: null } });
    // The switch ended a *previous* program; model that as the enrollment the
    // undo restores. Here we only assert the shadow-removal path, so simulate
    // the undo's own effect on the switched-to (shadow) enrollment directly via
    // the action against a previous program:
    const prev = await prisma.userProgram.create({
      data: { userId, name: "Prev", status: "ARCHIVED", daysPerWeek: 3, durationWeeks: 8, days: { create: [{ name: "A", dayIndex: 0 }] } },
      include: { days: true },
    });
    const prevEnr = await prisma.programEnrollment.create({
      data: { userId, programId: prev.id, status: "ABANDONED", currentWeek: 2, startedAt: monday(1), endedAt: new Date(now.getTime() - 60_000), programSnapshot: {} },
    });
    // Make `shadow` look started-with-the-switch (same instant as prevEnr ended).
    await prisma.programEnrollment.update({ where: { id: shadow.id }, data: { startedAt: prevEnr.endedAt! } });

    current = userId;
    await restorePreviousProgram(prevEnr.id).catch((e) => {
      // restorePreviousProgram ends with redirect(); swallow the mocked redirect throw.
      if (!(e instanceof Redirected)) throw e;
    });

    // The empty shadow is gone; the original 4-week enrollment is the one re-entry sees.
    expect(await prisma.programEnrollment.findUnique({ where: { id: shadow.id } })).toBeNull();
    const restart = await getProgramRestart(userId, program.id, now);
    expect(restart.resumable?.enrollmentId).toBe(original.id);
    // The original (currentWeek 4), not the week-1 shadow, is resumable. Its last
    // workout was weeks ago (not this calendar week) and the block is 13 weeks long
    // (no duration clamp), so the next workout counts in week 5 — resumePoint's
    // "the next one otherwise". (A-024 reads 4 only because its Duração was shrunk
    // to 4, clamping the resume to the last week.)
    expect(restart.resumable?.week).toBe(5);
  });
});

describe("A-027 · a later block hides the stale 'Bloco concluído' hero", () => {
  it("getRecentlyCompletedBlock returns null once a later enrollment started after the block ended", async () => {
    const userId = `${RUN}-u4`;
    await mkUser(userId);
    // A finished block: a COMPLETED enrollment that ended 3 days ago (inside the 14-day window).
    const { program, enrollment, dayIds } = await mkRunning(userId, 4, monday(4));
    for (let w = 1; w <= 4; w++) await session(userId, program.id, enrollment.id, dayIds[0], w, monday(4 - (w - 1)));
    await prisma.programEnrollment.update({
      where: { id: enrollment.id },
      data: { status: "COMPLETED", endedAt: new Date(now.getTime() - 3 * DAY_MS) },
    });
    await prisma.userProgram.update({
      where: { id: program.id },
      data: { status: "ARCHIVED", archivedAt: new Date(now.getTime() - 3 * DAY_MS) },
    });

    // Nothing started since → Today offers the completed-block hero.
    expect(await getRecentlyCompletedBlock(userId, now)).not.toBeNull();

    // The user starts the NEXT block (a new enrollment started after this one
    // ended) and then stops it. Today must now fall through to resume, not the
    // stale "Bloco concluído" hero whose "Começar GD N" would fork a duplicate.
    const next = await mkRunning(userId, 1, new Date(now.getTime() - 1 * DAY_MS));
    await prisma.programEnrollment.update({
      where: { id: next.enrollment.id },
      data: { status: "ABANDONED", endedAt: new Date(now.getTime() - 60_000) },
    });
    await prisma.userProgram.update({ where: { id: next.program.id }, data: { status: "ARCHIVED" } });

    expect(await getRecentlyCompletedBlock(userId, now)).toBeNull();
  });
});
