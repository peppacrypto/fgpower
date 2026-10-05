import "dotenv/config";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { EXERCISE_NOTE_MAX } from "@/lib/validation/program-builder";

/**
 * saveExerciseNote against the real local Postgres (A-003): a note is trimmed
 * and capped at EXERCISE_NOTE_MAX before it is stored, a blank note removes the
 * row, and a client that posts a non-string writes nothing.
 */

const USER = `note-${Date.now()}-u`;
vi.mock("@/lib/auth/require-user", () => ({ requireUserOrThrow: async () => ({ id: USER }) }));

const { prisma } = await import("@/lib/db");
const { saveExerciseNote } = await import("./exercise-notes");

let exerciseId: string;

beforeAll(async () => {
  await prisma.user.create({ data: { id: USER, name: USER, email: `${USER}@fgpower.test`, emailVerified: true } });
  const [ex] = await prisma.exercise.findMany({ select: { id: true }, take: 1, orderBy: { id: "asc" } });
  exerciseId = ex.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: USER } });
  await prisma.$disconnect();
});

const stored = () =>
  prisma.exerciseUserNote.findUnique({
    where: { userId_exerciseId: { userId: USER, exerciseId } },
    select: { note: true },
  });

it("caps an oversized note at EXERCISE_NOTE_MAX characters", async () => {
  await saveExerciseNote(exerciseId, "A".repeat(EXERCISE_NOTE_MAX + 50_000));
  expect((await stored())?.note).toHaveLength(EXERCISE_NOTE_MAX);
});

it("trims and keeps a normal note as typed", async () => {
  await saveExerciseNote(exerciseId, "  banco na posição 4  ");
  expect((await stored())?.note).toBe("banco na posição 4");
});

it("removes the row when the note is blank", async () => {
  await saveExerciseNote(exerciseId, "   ");
  expect(await stored()).toBeNull();
});

it("writes nothing when the payload is not a string", async () => {
  await saveExerciseNote(exerciseId, undefined as unknown as string);
  expect(await stored()).toBeNull();
});
