import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";

/**
 * saveProgram against the real local Postgres: bad input comes back as field
 * errors (never a throw, never a half-saved program), and a good save writes
 * name + days in one go and hands back the day ids.
 */

const RUN_ID = `builder-${Date.now()}`;
const USER_ID = `${RUN_ID}-owner`;
const OTHER_ID = `${RUN_ID}-other`;
let sessionUserId: string | null = USER_ID;

vi.mock("@/lib/auth/require-user", () => ({
  getCurrentSession: async () => (sessionUserId ? { user: { id: sessionUserId } } : null),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { saveProgram } = await import("./program-builder");

let programId: string;
let exerciseId: string;

const exercise = (patch: Record<string, unknown> = {}) => ({
  exerciseId,
  exerciseName: "Supino",
  groupKey: null,
  sets: 3,
  repMin: 8,
  repMax: 12,
  rirTarget: 2,
  restSeconds: 120,
  warmupSets: 0,
  loadTargetKg: null,
  notes: null,
  ...patch,
});

async function programRows() {
  return prisma.userProgram.findUniqueOrThrow({
    where: { id: programId },
    include: { days: { orderBy: { dayIndex: "asc" }, include: { exercises: { orderBy: { sortOrder: "asc" } } } } },
  });
}

beforeAll(async () => {
  for (const id of [USER_ID, OTHER_ID]) {
    await prisma.user.create({ data: { id, name: id, email: `${id}@fgpower.test`, emailVerified: true } });
  }
  const ex = await prisma.exercise.findFirstOrThrow({ select: { id: true } });
  exerciseId = ex.id;
  const program = await prisma.userProgram.create({
    data: {
      userId: USER_ID,
      name: "Original",
      status: "DRAFT",
      days: { create: [{ dayIndex: 0, name: "Dia A", exercises: { create: [{ exerciseId, sortOrder: 0 }] } }] },
    },
  });
  programId = program.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [USER_ID, OTHER_ID] } } });
  await prisma.$disconnect();
});

describe("saveProgram", () => {
  it("returns field errors for invalid numbers and writes nothing (no rename either)", async () => {
    const before = await programRows();
    const result = await saveProgram(programId, {
      name: "Renomeado",
      description: "",
      days: [{ id: before.days[0].id, name: "Dia A", focus: null, exercises: [exercise(), exercise({ sets: 0 })] }],
    });
    expect(result).toEqual({
      ok: false,
      message: null,
      errors: [{ dayIndex: 0, exerciseIndex: 1, field: "sets", message: "Use de 1 a 30." }],
    });
    const after = await programRows();
    expect(after.name).toBe("Original");
    expect(after.days[0].exercises).toHaveLength(1);
  });

  it("rejects an inverted rep range and an empty name", async () => {
    const before = await programRows();
    const result = await saveProgram(programId, {
      name: "   ",
      description: "",
      days: [{ id: before.days[0].id, name: "Dia A", focus: null, exercises: [exercise({ repMin: 15, repMax: 6 })] }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.map((e) => e.field).sort()).toEqual(["name", "repMin"]);
    expect((await programRows()).name).toBe("Original");
  });

  it("saves name and days together, keeps the existing day id and returns new ones", async () => {
    const before = await programRows();
    const keptId = before.days[0].id;
    const result = await saveProgram(programId, {
      name: "  Meu PPL  ",
      description: "  Três dias  ",
      days: [
        { name: "Novo dia", focus: null, exercises: [exercise({ sets: 5 })] },
        { id: keptId, name: "Dia A", focus: null, exercises: [exercise(), exercise({ repMin: 6, repMax: 8 })] },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.name).toBe("Meu PPL");
    expect(result.description).toBe("Três dias");
    expect(result.dayIds).toHaveLength(2);
    expect(result.dayIds[1]).toBe(keptId);

    const after = await programRows();
    expect(after.name).toBe("Meu PPL");
    expect(after.description).toBe("Três dias");
    expect(after.days.map((d) => d.id)).toEqual(result.dayIds);
    expect(after.days[0].exercises.map((e) => e.sets)).toEqual([5]);
    expect(after.days[1].exercises.map((e) => [e.repMin, e.repMax])).toEqual([
      [8, 12],
      [6, 8],
    ]);

    // Saving again with the returned ids updates in place (no new day rows).
    const again = await saveProgram(programId, {
      name: "Meu PPL",
      description: "",
      days: after.days.map((d) => ({ id: d.id, name: d.name, focus: d.focus, exercises: [exercise()] })),
    });
    expect(again.ok && again.dayIds).toEqual(result.dayIds);
    expect((await programRows()).description).toBeNull();
  });

  it("refuses someone else's program without throwing", async () => {
    sessionUserId = OTHER_ID;
    try {
      const result = await saveProgram(programId, { name: "Hack", description: "", days: [] });
      expect(result).toEqual({ ok: false, errors: [], message: "Programa não encontrado." });
    } finally {
      sessionUserId = USER_ID;
    }
    expect((await programRows()).name).toBe("Meu PPL");
  });

  it("asks to sign in again when the session is gone", async () => {
    sessionUserId = null;
    try {
      const result = await saveProgram(programId, { name: "X", description: "", days: [] });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toMatch(/sessão expirou/);
    } finally {
      sessionUserId = USER_ID;
    }
  });
});
