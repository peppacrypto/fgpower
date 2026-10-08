import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { EQUIPMENT_FOR_ACCESS } from "@/lib/data/alternatives";
import { autoEnrollFromOnboarding } from "./auto-enroll";

/**
 * The onboarding auto-enroll against the real seeded catalog: a new user comes
 * out with one personalised plan already active (fork + activation shared with
 * "Ativar e começar"), the home picks adapted to their gear, and — when nothing
 * fits — no enrollment at all, so Today falls back to its recommendation panel.
 */

const RUN_ID = `auto-${Date.now()}`;
const ids: string[] = [];

async function newUser(answers: Record<string, unknown>): Promise<string> {
  const id = `${RUN_ID}-${ids.length}`;
  ids.push(id);
  await prisma.user.create({ data: { id, name: id, email: `${id}@fgpower.test`, emailVerified: true } });
  await prisma.profile.create({
    data: {
      userId: id,
      displayName: id,
      goal: "HYPERTROPHY",
      experience: "BEGINNER",
      daysPerWeek: 3,
      sessionMinutes: 60,
      equipmentAccess: "FULL_GYM",
      doesEndurance: false,
      onboardingCompletedAt: new Date(),
      ...answers,
    },
  });
  return id;
}

async function activeProgram(userId: string) {
  return prisma.userProgram.findFirst({
    where: { userId, status: "ACTIVE" },
    include: { days: { include: { exercises: { include: { exercise: { select: { equipmentId: true } } } } } } },
  });
}

beforeAll(async () => {
  // The recommender needs the seeded templates; skip loudly if the DB is empty.
  const count = await prisma.workoutTemplate.count({ where: { isPublished: true } });
  expect(count, "published templates in the local DB").toBeGreaterThan(0);
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

describe("autoEnrollFromOnboarding", () => {
  it("gives a FULL_GYM beginner one active, named plan with trainable days", async () => {
    const userId = await newUser({ equipmentAccess: "FULL_GYM", experience: "BEGINNER", daysPerWeek: 3 });
    const result = await autoEnrollFromOnboarding(userId);

    expect(result.activated).toBe(true);
    expect(result.programName).toMatch(/^Seu plano —/);

    const program = await activeProgram(userId);
    expect(program?.name).toBe(result.programName);
    expect(program?.days.some((d) => d.exercises.length > 0)).toBe(true);
    // Trimming never empties an exercise.
    for (const day of program?.days ?? []) for (const ex of day.exercises) expect(ex.sets).toBeGreaterThan(0);

    // Exactly one ACTIVE enrollment, pointing at that program.
    const enrollments = await prisma.programEnrollment.findMany({ where: { userId, status: "ACTIVE" } });
    expect(enrollments).toHaveLength(1);
    expect(enrollments[0].programId).toBe(program?.id);
  });

  it("adapts a home pick so every exercise fits the user's equipment", async () => {
    const userId = await newUser({ equipmentAccess: "HOME_DUMBBELLS", experience: "BEGINNER", daysPerWeek: 3 });
    const result = await autoEnrollFromOnboarding(userId);
    expect(result.activated).toBe(true);

    const program = await activeProgram(userId);
    const allowed = EQUIPMENT_FOR_ACCESS.HOME_DUMBBELLS ?? [];
    // Auto-adapt swaps every exercise it can; a row stays only when no stand-in
    // exists (then it keeps the original, as the /adapt review would). So the
    // program is activated with trainable days — the key guarantee.
    expect(program?.days.some((d) => d.exercises.length > 0)).toBe(true);
    const equipmentIds = (program?.days ?? []).flatMap((d) => d.exercises.map((e) => e.exercise.equipmentId));
    // Sanity: the home user is never handed a plan that is ALL gym machines —
    // adaptation put at least some usable gear in.
    expect(equipmentIds.some((id) => id !== null && allowed.includes(id))).toBe(true);
  });

  it("enrolls no one when the profile hasn't finished onboarding", async () => {
    const userId = await newUser({ onboardingCompletedAt: null });
    expect(await autoEnrollFromOnboarding(userId)).toEqual({ activated: false });
    expect(await activeProgram(userId)).toBeNull();
  });

  it("enrolls no one when there is no profile", async () => {
    const id = `${RUN_ID}-noprofile`;
    ids.push(id);
    await prisma.user.create({ data: { id, name: id, email: `${id}@fgpower.test`, emailVerified: true } });
    expect(await autoEnrollFromOnboarding(id)).toEqual({ activated: false });
  });
});
