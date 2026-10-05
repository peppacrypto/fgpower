import "dotenv/config";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { MAX_PROGRAMS_PER_USER, PROGRAM_NAME_MAX } from "@/lib/validation/program-builder";

/**
 * Per-account program caps and name normalization against the real local
 * Postgres (A-003). createCustomProgram trims/caps the name and never stores a
 * blank one; once the account holds MAX_PROGRAMS_PER_USER non-archived
 * programs, create and duplicate refuse with a redirect to the shelf, while
 * archived programs don't count toward the cap.
 */

const USER = `plimit-${Date.now()}-u`;
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
const { createCustomProgram, duplicateProgram } = await import("./programs");

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
});

beforeEach(async () => {
  await prisma.userProgram.deleteMany({ where: { userId: USER } });
});

afterAll(async () => {
  await prisma.userProgram.deleteMany({ where: { userId: USER } });
  await prisma.user.deleteMany({ where: { id: USER } });
  await prisma.$disconnect();
});

it("trims and caps the name, falling back to a default when blank", async () => {
  expect(await redirectOf(createCustomProgram("   "))).toMatch(/^\/app\/programs\/[^/]+\/edit$/);
  expect((await prisma.userProgram.findFirstOrThrow({ where: { userId: USER } })).name).toBe("Meu programa");

  await prisma.userProgram.deleteMany({ where: { userId: USER } });
  await redirectOf(createCustomProgram("  Força total  "));
  expect((await prisma.userProgram.findFirstOrThrow({ where: { userId: USER } })).name).toBe("Força total");

  await prisma.userProgram.deleteMany({ where: { userId: USER } });
  await redirectOf(createCustomProgram("N".repeat(PROGRAM_NAME_MAX + 5_000)));
  expect((await prisma.userProgram.findFirstOrThrow({ where: { userId: USER } })).name).toHaveLength(PROGRAM_NAME_MAX);
});

it("refuses a new program past the per-account cap", async () => {
  await prisma.userProgram.createMany({
    data: Array.from({ length: MAX_PROGRAMS_PER_USER }, (_, i) => ({
      userId: USER,
      name: `P${i}`,
      status: "DRAFT" as const,
    })),
  });
  expect(await redirectOf(createCustomProgram("over the line"))).toBe("/app/programs?limite=1");
  expect(await prisma.userProgram.count({ where: { userId: USER } })).toBe(MAX_PROGRAMS_PER_USER);
});

it("does not count archived programs toward the cap", async () => {
  await prisma.userProgram.createMany({
    data: Array.from({ length: MAX_PROGRAMS_PER_USER }, (_, i) => ({
      userId: USER,
      name: `A${i}`,
      status: "ARCHIVED" as const,
      archivedAt: new Date(),
    })),
  });
  expect(await redirectOf(createCustomProgram("still allowed"))).toMatch(/\/edit$/);
  expect(await prisma.userProgram.count({ where: { userId: USER, status: { in: ["DRAFT", "ACTIVE"] } } })).toBe(1);
});

it("refuses duplicateProgram past the cap, keeping the original", async () => {
  const original = await prisma.userProgram.create({
    data: { userId: USER, name: "Base", status: "DRAFT" },
    select: { id: true },
  });
  await prisma.userProgram.createMany({
    data: Array.from({ length: MAX_PROGRAMS_PER_USER - 1 }, (_, i) => ({
      userId: USER,
      name: `F${i}`,
      status: "DRAFT" as const,
    })),
  });
  // Account now holds exactly MAX_PROGRAMS_PER_USER non-archived programs.
  expect(await redirectOf(duplicateProgram(original.id))).toBe("/app/programs?limite=1");
  expect(await prisma.userProgram.count({ where: { userId: USER } })).toBe(MAX_PROGRAMS_PER_USER);
});
