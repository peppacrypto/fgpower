import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * A-037 against the real local Postgres: the hot relation counts are bounded to
 * the ids in play, not aggregated over the whole child table. We mock @/lib/db
 * with a query-logging client, capture the SQL each function emits, and assert
 * none is the unfiltered `WHERE 1=1 ... GROUP BY` form (the plan the finding
 * caught) while the bounded `IN (...)` / scoped `= $1` form is — and that the
 * counts themselves are still right.
 */

const USER = `a037-${Date.now()}-u`;

// A logging client bound to the same DATABASE_URL as @/lib/db, so the real
// functions (which import { prisma } from "@/lib/db") run against it and we see
// every statement they issue.
const cap = vi.hoisted(() => ({ queries: [] as string[] }));

vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@/generated/prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const client = new PrismaClient({
    adapter,
    omit: { activity: { shareToken: true } },
    log: [{ emit: "event", level: "query" }],
  });
  client.$on("query", (e: { query: string }) => cap.queries.push(e.query));
  return { prisma: client };
});
vi.mock("@/lib/auth/require-user", () => ({ requireUserOrThrow: async () => ({ id: USER }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
class Redirected extends Error {
  constructor(public url: string) {
    super(`REDIRECT ${url}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Redirected(url);
  },
}));

const { prisma } = await import("@/lib/db");
const { loadStreakInputs } = await import("@/lib/data/streak-data");
const { deleteUntrainedProgram } = await import("@/lib/actions/programs");

/** The unfiltered aggregate the finding caught (LEFT JOIN … WHERE 1=1 GROUP BY). */
const UNFILTERED = /where 1=1\s+group by/i;

let exerciseId: string;
let trainedProgramId: string;
let draftProgramId: string;

async function redirectUrl(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (err) {
    if (err instanceof Redirected) return err.url;
    throw err;
  }
  throw new Error("expected a redirect");
}

beforeAll(async () => {
  await prisma.user.create({ data: { id: USER, name: USER, email: `${USER}@fgpower.test`, emailVerified: true } });
  await prisma.profile.create({ data: { userId: USER, displayName: USER, daysPerWeek: 3 } });
  const [ex] = await prisma.exercise.findMany({ select: { id: true }, take: 1, orderBy: { id: "asc" } });
  exerciseId = ex.id;

  // Trained program: day A has 2 exercises, day B has 0, day C has 1 — so the
  // per-day counts are [2, 0, 1] and "trainable days" is 2.
  const program = await prisma.userProgram.create({
    data: {
      userId: USER,
      name: "A-037 trained",
      status: "ACTIVE",
      daysPerWeek: 3,
      durationWeeks: 8,
      days: {
        create: [
          { dayIndex: 0, name: "A", exercises: { create: [{ exerciseId, sortOrder: 0 }, { exerciseId, sortOrder: 1 }] } },
          { dayIndex: 1, name: "B" },
          { dayIndex: 2, name: "C", exercises: { create: [{ exerciseId, sortOrder: 0 }] } },
        ],
      },
    },
    include: { days: { orderBy: { dayIndex: "asc" } } },
  });
  trainedProgramId = program.id;
  await prisma.programEnrollment.create({
    data: {
      userId: USER,
      programId: trainedProgramId,
      status: "ACTIVE",
      startedAt: new Date(Date.now() - 7 * 86_400_000),
      currentWeek: 1,
      nextDayIndex: 0,
      programSnapshot: {},
    },
  });
  // One COMPLETED workout on the trained program (so it cannot be deleted) and
  // one DISCARDED (which must not count).
  await prisma.workoutSession.create({
    data: { userId: USER, programId: trainedProgramId, name: "done", status: "COMPLETED", totalWorkingSets: 3, finishedAt: new Date() },
  });
  await prisma.workoutSession.create({
    data: { userId: USER, programId: trainedProgramId, name: "junk", status: "DISCARDED" },
  });

  // A draft program never trained — deletable.
  const draft = await prisma.userProgram.create({ data: { userId: USER, name: "A-037 draft", status: "DRAFT", daysPerWeek: 3 } });
  draftProgramId = draft.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: USER } });
  await prisma.$disconnect();
});

describe("A-037 relation counts are bounded, not whole-table aggregates", () => {
  it("loadStreakInputs returns the right per-day exercise counts via a bounded query", async () => {
    cap.queries.length = 0;
    const { enrollments } = await loadStreakInputs(USER, new Date());

    const mine = enrollments.find((e) => e.program.days.length === 3)!;
    expect(mine.program.days.map((d) => [d.dayIndex, d.exerciseCount])).toEqual([
      [0, 2],
      [1, 0],
      [2, 1],
    ]);

    // No unfiltered GROUP BY over UserProgramExercise…
    expect(cap.queries.some((q) => UNFILTERED.test(q))).toBe(false);
    // …and the count it did run is bounded to these days' ids.
    expect(
      cap.queries.some((q) => /userprogramexercise/i.test(q) && /\bin\s*\(/i.test(q) && /group by/i.test(q)),
    ).toBe(true);
  });

  it("deleteUntrainedProgram counts sessions scoped to one programId (no whole-table aggregate)", async () => {
    cap.queries.length = 0;
    // The trained program has a COMPLETED session → kept, redirected to its page.
    const url = await redirectUrl(deleteUntrainedProgram(trainedProgramId));
    expect(url).toBe(`/app/programs/${trainedProgramId}`);

    expect(cap.queries.some((q) => UNFILTERED.test(q))).toBe(false);
    expect(
      cap.queries.some((q) => /workoutsession/i.test(q) && /"programid"/i.test(q) && /=\s*\$\d/i.test(q)),
    ).toBe(true);

    // The trained program is still there (DISCARDED-only would have been deletable).
    expect(await prisma.userProgram.count({ where: { id: trainedProgramId } })).toBe(1);
  });

  it("deleteUntrainedProgram removes a never-trained draft", async () => {
    const url = await redirectUrl(deleteUntrainedProgram(draftProgramId));
    expect(url).toBe("/app/programs?excluido=1");
    expect(await prisma.userProgram.count({ where: { id: draftProgramId } })).toBe(0);
  });
});
