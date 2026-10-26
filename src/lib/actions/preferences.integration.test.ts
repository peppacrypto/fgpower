import "dotenv/config";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { SESSION_EXPIRED_ERROR } from "@/lib/auth/session-expired";

/**
 * updateWorkoutPreferences (Settings → Durante o treino) against the real
 * local Postgres: the two switches save; the retired "Salto de carga" never
 * reaches the profile — a block that still carries it (an old client) is
 * refused whole — and the gym's loads (Minha academia) are left alone; with
 * the session gone it says so and writes nothing.
 */

const USER = `prefs-${Date.now()}-u`;
let signedIn = true;
vi.mock("@/lib/auth/require-user", () => ({
  requireUserOrThrow: async () => {
    if (!signedIn) throw new Error("no session");
    return { id: USER };
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { prisma } = await import("@/lib/db");
const { updateWorkoutPreferences } = await import("./preferences");

beforeAll(async () => {
  await prisma.user.create({ data: { id: USER, name: USER, email: `${USER}@fgpower.test`, emailVerified: true } });
  await prisma.profile.create({ data: { userId: USER, displayName: "Prefs", loadIncrementKg: 1, cableStepKg: 2.5 } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: USER } });
  await prisma.$disconnect();
});

const stored = () =>
  prisma.profile.findUniqueOrThrow({
    where: { userId: USER },
    select: { restTimerSound: true, hapticsEnabled: true, loadIncrementKg: true, cableStepKg: true },
  });

it("saves the two switches and leaves the retired step and the gym's loads as they were", async () => {
  const result = await updateWorkoutPreferences({ restTimerSound: false, hapticsEnabled: false });
  expect(result).toEqual({ ok: true, savedAt: expect.any(String) });
  expect(await stored()).toEqual({ restTimerSound: false, hapticsEnabled: false, loadIncrementKg: 1, cableStepKg: 2.5 });
});

it("refuses a block that still carries the load step, and writes none of it", async () => {
  const stale = { restTimerSound: true, hapticsEnabled: true, loadIncrementKg: 5 };
  const result = await updateWorkoutPreferences(stale as unknown as Parameters<typeof updateWorkoutPreferences>[0]);
  expect(result).toEqual({ ok: false, error: "Não foi possível salvar agora. Tente de novo." });
  expect(await stored()).toEqual({ restTimerSound: false, hapticsEnabled: false, loadIncrementKg: 1, cableStepKg: 2.5 });
});

it("says the session expired when there is none, and writes nothing", async () => {
  signedIn = false;
  try {
    expect(await updateWorkoutPreferences({ restTimerSound: true, hapticsEnabled: true })).toEqual({ ok: false, error: SESSION_EXPIRED_ERROR });
  } finally {
    signedIn = true;
  }
  expect(await stored()).toMatchObject({ restTimerSound: false, hapticsEnabled: false });
});
