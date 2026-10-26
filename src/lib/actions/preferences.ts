"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/require-user";
import { SESSION_EXPIRED_ERROR } from "@/lib/auth/session-expired";
import { prisma } from "@/lib/db";
import { workoutPreferencesSchema, type WorkoutPreferences } from "@/lib/validation/preferences";
import type { SettingsSaveResult } from "./result";

const GENERIC_ERROR = "Não foi possível salvar agora. Tente de novo.";

/**
 * Workout-screen preferences (autosaved in Settings → Durante o treino): the
 * end-of-rest beep and vibration. The whole block is sent on every change and
 * validated by a strict schema: the client object goes straight into the
 * update, so unknown keys — the retired "Salto de carga" (loadIncrementKg)
 * among them; loads follow Minha academia now (lib/actions/gym) — never reach
 * Prisma. The workout reads the profile per request.
 */
export async function updateWorkoutPreferences(prefs: WorkoutPreferences): Promise<SettingsSaveResult> {
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return { ok: false, error: SESSION_EXPIRED_ERROR };
  const parsed = workoutPreferencesSchema.safeParse(prefs);
  if (!parsed.success) return { ok: false, error: GENERIC_ERROR };
  try {
    await prisma.profile.update({ where: { userId: user.id }, data: parsed.data });
  } catch (err) {
    console.error("updateWorkoutPreferences failed", err);
    return { ok: false, error: GENERIC_ERROR };
  }
  revalidatePath("/app/settings");
  return { ok: true, savedAt: new Date().toISOString() };
}
