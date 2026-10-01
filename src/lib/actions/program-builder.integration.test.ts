import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";

/**
 * saveProgram against the real local Postgres: bad input comes back as field
 * errors (never a throw, never a half-saved program), a good save writes
 * name + days in one go and hands back the day ids, and exercise rows are
 * updated in place — logged workouts stay linked and the fields the builder
 * doesn't edit survive (W-114).
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
let otherExerciseId: string;

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
  const [ex, other] = await prisma.exercise.findMany({ select: { id: true }, take: 2, orderBy: { id: "asc" } });
  exerciseId = ex.id;
  otherExerciseId = other.id;
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

  it("updates exercise rows in place: history stays linked and unedited fields survive", async () => {
    // A program as a template fork leaves it: two rows carrying tempo, RPE and
    // progression settings the builder shows no box for.
    const program = await prisma.userProgram.create({
      data: {
        userId: USER_ID,
        name: "Fork",
        status: "ACTIVE",
        days: {
          create: [
            {
              dayIndex: 0,
              name: "Dia A",
              exercises: {
                create: [
                  { exerciseId, sortOrder: 0, rpeTarget: 8, tempo: "3-1-1-0", progressionStrategy: "DOUBLE", loadIncrementKg: 2.5, notes: "Pausa no peito" },
                  { exerciseId: otherExerciseId, sortOrder: 1, progressionStrategy: "LINEAR_LOAD", loadIncrementKg: 5 },
                ],
              },
            },
          ],
        },
      },
      include: { days: { include: { exercises: { orderBy: { sortOrder: "asc" } } } } },
    });
    const day = program.days[0];
    const [first, second] = day.exercises;
    // A logged workout pointing at both rows.
    const session = await prisma.workoutSession.create({
      data: {
        userId: USER_ID,
        programId: program.id,
        programDayId: day.id,
        name: "Dia A",
        status: "COMPLETED",
        exerciseLogs: {
          create: [first, second].map((row, i) => ({
            userId: USER_ID,
            exerciseId: row.exerciseId,
            programExerciseId: row.id,
            sortOrder: i,
            prescribedSets: 3,
            repMin: 8,
            repMax: 12,
            restSeconds: 120,
          })),
        },
      },
    });
    const builderRow = (row: typeof first, patch: Record<string, unknown> = {}) => ({
      id: row.id,
      exerciseId: row.exerciseId,
      groupKey: row.groupKey,
      sets: row.sets,
      repMin: row.repMin,
      repMax: row.repMax,
      rirTarget: row.rirTarget,
      restSeconds: row.restSeconds,
      warmupSets: row.warmupSets,
      loadTargetKg: row.loadTargetKg,
      notes: row.notes,
      ...patch,
    });

    // Swap the order, change a number, rename the day — and send stale carried
    // values: an existing row keeps its own.
    const result = await saveProgram(program.id, {
      name: "Fork",
      description: "",
      days: [
        {
          id: day.id,
          name: "Dia A renomeado",
          focus: null,
          exercises: [builderRow(second, { sets: 5 }), builderRow(first, { progressionStrategy: "MANUAL", tempo: null })],
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.exerciseIds).toEqual([[second.id, first.id]]);

    const rows = await prisma.userProgramExercise.findMany({ where: { dayId: day.id }, orderBy: { sortOrder: "asc" } });
    expect(rows.map((r) => [r.id, r.sortOrder, r.sets])).toEqual([
      [second.id, 0, 5],
      [first.id, 1, first.sets],
    ]);
    expect(rows[1]).toMatchObject({ rpeTarget: 8, tempo: "3-1-1-0", progressionStrategy: "DOUBLE", loadIncrementKg: 2.5, notes: "Pausa no peito" });
    expect(rows[0]).toMatchObject({ progressionStrategy: "LINEAR_LOAD", loadIncrementKg: 5 });
    const logs = await prisma.workoutExerciseLog.findMany({ where: { sessionId: session.id }, orderBy: { sortOrder: "asc" } });
    expect(logs.map((l) => l.programExerciseId)).toEqual([first.id, second.id]);

    // Remove one row, duplicate the other (a copy has no id but keeps the
    // carried fields), and add a fresh one.
    const firstNow = rows[1];
    const again = await saveProgram(program.id, {
      name: "Fork",
      description: "",
      days: [
        {
          id: day.id,
          name: "Dia A renomeado",
          focus: null,
          exercises: [
            builderRow(firstNow),
            builderRow(firstNow, { id: undefined, rpeTarget: 8, tempo: "3-1-1-0", progressionStrategy: "DOUBLE", loadIncrementKg: 2.5 }),
            builderRow(firstNow, { id: undefined, exerciseId: otherExerciseId, notes: null }),
          ],
        },
      ],
    });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    const [ids] = again.exerciseIds;
    expect(ids).toHaveLength(3);
    expect(ids[0]).toBe(first.id);
    expect(new Set(ids).size).toBe(3);
    const after = await prisma.userProgramExercise.findMany({ where: { dayId: day.id }, orderBy: { sortOrder: "asc" } });
    expect(after.map((r) => r.id)).toEqual(ids);
    expect(after[1]).toMatchObject({ rpeTarget: 8, tempo: "3-1-1-0", progressionStrategy: "DOUBLE", loadIncrementKg: 2.5 });
    expect(after[2]).toMatchObject({ exerciseId: otherExerciseId, rpeTarget: null, tempo: null, progressionStrategy: null, loadIncrementKg: null });
    // The removed row is gone; its log keeps its own snapshot, unlinked.
    expect(await prisma.userProgramExercise.findUnique({ where: { id: second.id } })).toBeNull();
    const logsAfter = await prisma.workoutExerciseLog.findMany({ where: { sessionId: session.id }, orderBy: { sortOrder: "asc" } });
    expect(logsAfter.map((l) => l.programExerciseId)).toEqual([first.id, null]);
  });

  it("stores supersets canonical (W-104): stray keys fixed, rows kept in place when regrouped", async () => {
    const payload = (keys: (string | null)[], ids: (string | undefined)[] = []) => ({
      name: "Supersets",
      description: "",
      days: [
        {
          name: "Dia A",
          focus: null,
          exercises: keys.map((groupKey, i) => exercise({ id: ids[i], groupKey, exerciseId: i % 2 ? otherExerciseId : exerciseId })),
        },
      ],
    });
    const created = await prisma.userProgram.create({ data: { userId: USER_ID, name: "Supersets", status: "DRAFT" } });
    const r1 = await saveProgram(created.id, payload(["x", "X ", null, "Y"]));
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    const stored = async () =>
      (
        await prisma.userProgramExercise.findMany({
          where: { day: { programId: created.id } },
          orderBy: { sortOrder: "asc" },
          select: { id: true, groupKey: true },
        })
      ).map((r) => [r.id, r.groupKey] as const);
    const first = await stored();
    expect(first.map(([, k]) => k)).toEqual(["A", "A", null, null]);

    // Regrouped: rows 2–3 become the pair; every row keeps its id.
    const ids = r1.exerciseIds[0];
    const r2 = await saveProgram(created.id, payload([null, null, "A", "A"], ids));
    expect(r2.ok).toBe(true);
    const second = await stored();
    expect(second.map(([id]) => id)).toEqual(ids);
    expect(second.map(([, k]) => k)).toEqual([null, null, "A", "A"]);
  });

  it("never touches another program's rows, and a repeated id becomes a new row", async () => {
    const [mine, theirs] = await Promise.all(
      [USER_ID, OTHER_ID].map((userId) =>
        prisma.userProgram.create({
          data: {
            userId,
            name: "P",
            days: { create: [{ dayIndex: 0, name: "Dia", exercises: { create: [{ exerciseId, sortOrder: 0, sets: 4 }] } }] },
          },
          include: { days: { include: { exercises: true } } },
        }),
      ),
    );
    const mineRow = mine.days[0].exercises[0];
    const theirRow = theirs.days[0].exercises[0];
    const result = await saveProgram(mine.id, {
      name: "P",
      description: "",
      days: [
        {
          id: mine.days[0].id,
          name: "Dia",
          focus: null,
          // Someone else's row id, and our own row sent twice (a stale duplicate).
          exercises: [exercise({ id: theirRow.id, sets: 9 }), exercise({ id: mineRow.id }), exercise({ id: mineRow.id, sets: 2 })],
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [ids] = result.exerciseIds;
    expect(ids[1]).toBe(mineRow.id);
    expect(ids[0]).not.toBe(theirRow.id);
    expect(ids[2]).not.toBe(mineRow.id);
    expect(await prisma.userProgramExercise.findUniqueOrThrow({ where: { id: theirRow.id } })).toMatchObject({
      dayId: theirs.days[0].id,
      sets: 4,
    });
    const rows = await prisma.userProgramExercise.findMany({ where: { dayId: mine.days[0].id }, orderBy: { sortOrder: "asc" } });
    expect(rows.map((r) => [r.id, r.sets])).toEqual([
      [ids[0], 9],
      [mineRow.id, 3],
      [ids[2], 2],
    ]);
  });

  it("drops a bad carried value instead of blocking the save", async () => {
    const before = await programRows();
    const result = await saveProgram(programId, {
      name: before.name,
      description: "",
      days: before.days.map((d) => ({
        id: d.id,
        name: d.name,
        focus: d.focus,
        exercises: [exercise({ progressionStrategy: "BOGUS", tempo: "x".repeat(500), loadIncrementKg: -1, rpeTarget: "oito" })],
      })) as never,
    });
    expect(result.ok).toBe(true);
    const created = (await programRows()).days[0].exercises[0];
    expect(created).toMatchObject({ progressionStrategy: null, tempo: null, loadIncrementKg: null, rpeTarget: null });
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
