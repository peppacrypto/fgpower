import "dotenv/config";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

/**
 * Program activation against the real local Postgres (A-007). Two overlapping
 * "activate program" taps must leave exactly one ACTIVE enrollment: the server
 * actions serialize per user behind pg_advisory_xact_lock and re-read the
 * active enrollment under the lock, and a partial unique index
 * (ProgramEnrollment_userId_active_key) is the database-level backstop.
 */

const USER = `activation-${Date.now()}-u`;
vi.mock("@/lib/auth/require-user", () => ({ requireUserOrThrow: async () => ({ id: USER }) }));
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

const { prisma } = await import("@/lib/db");
const { startProgram } = await import("./programs");

let programA: string;
let programB: string;

/** A user-owned program with one day that has one exercise (so it is startable). */
async function makeProgram(name: string, exerciseId: string): Promise<string> {
  const program = await prisma.userProgram.create({
    data: {
      userId: USER,
      name,
      status: "DRAFT",
      daysPerWeek: 3,
      days: {
        create: [
          {
            dayIndex: 0,
            name: "Dia 1",
            exercises: { create: [{ exerciseId, sortOrder: 0 }] },
          },
        ],
      },
    },
    select: { id: true },
  });
  return program.id;
}

/** Fire an action and return the redirect URL it threw (or rethrow anything else). */
async function redirectOf(p: Promise<unknown>): Promise<string> {
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
  await prisma.profile.create({ data: { userId: USER, displayName: "Activation", daysPerWeek: 3, preferredDays: [1, 3, 5] } });
  const [ex] = await prisma.exercise.findMany({ select: { id: true }, take: 1, orderBy: { id: "asc" } });
  programA = await makeProgram("Programa A", ex.id);
  programB = await makeProgram("Programa B", ex.id);
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: USER } });
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Each test starts from no active enrollment and both programs on the shelf.
  await prisma.programEnrollment.deleteMany({ where: { userId: USER } });
  await prisma.userProgram.updateMany({
    where: { userId: USER },
    data: { status: "DRAFT", archivedAt: null },
  });
});

it("the partial unique index rejects a second ACTIVE enrollment for the same user", async () => {
  await prisma.programEnrollment.create({
    data: { userId: USER, programId: programA, status: "ACTIVE", programSnapshot: {} },
  });
  await expect(
    prisma.programEnrollment.create({
      data: { userId: USER, programId: programA, status: "ACTIVE", programSnapshot: {} },
    }),
  ).rejects.toMatchObject({ code: "P2002" });
});

it("two overlapping taps on the SAME program leave exactly one ACTIVE enrollment", async () => {
  const [a, b] = await Promise.allSettled([redirectOf(startProgram(programA)), redirectOf(startProgram(programA))]);
  expect(a.status).toBe("fulfilled");
  expect(b.status).toBe("fulfilled");

  const active = await prisma.programEnrollment.findMany({ where: { userId: USER, status: "ACTIVE" }, select: { programId: true } });
  expect(active).toHaveLength(1);
  expect(active[0].programId).toBe(programA);
});

it("two overlapping taps on DIFFERENT programs leave exactly one ACTIVE enrollment (a clean switch)", async () => {
  const [a, b] = await Promise.allSettled([redirectOf(startProgram(programA)), redirectOf(startProgram(programB))]);
  expect(a.status).toBe("fulfilled");
  expect(b.status).toBe("fulfilled");

  const active = await prisma.programEnrollment.count({ where: { userId: USER, status: "ACTIVE" } });
  expect(active).toBe(1);
});
