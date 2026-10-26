"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/require-user";
import { SESSION_EXPIRED_ERROR } from "@/lib/auth/session-expired";
import { prisma } from "@/lib/db";
import { normalizeMissingGear } from "@/lib/exercises/gear";
import { exerciseStepSchema, gearIdsSchema, gymLoadsSchema } from "@/lib/validation/gym";
import type { GymLoadSettings } from "@/lib/training/load-grid";
import type { ActionResult, SettingsSaveResult } from "./result";

const GENERIC_ERROR = "Não foi possível salvar agora. Tente de novo.";

/** Every screen that reads the gym: suggestions, swaps, the program's flags, Settings. */
function revalidateGym() {
  revalidatePath("/app/settings");
  revalidatePath("/app/today");
  revalidatePath("/app/programs", "layout");
  revalidatePath("/app/workout", "layout");
}

/**
 * Settings → Minha academia → Pesos (autosaved): how the user's gym spaces
 * its dumbbells, stacks, plates and kettlebells. The workout, the summary and
 * the history read the profile per request, so the next suggestion follows.
 */
export async function updateGymLoads(settings: GymLoadSettings): Promise<SettingsSaveResult> {
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return { ok: false, error: SESSION_EXPIRED_ERROR };
  const parsed = gymLoadsSchema.safeParse(settings);
  if (!parsed.success) return { ok: false, error: GENERIC_ERROR };
  try {
    await prisma.profile.update({ where: { userId: user.id }, data: parsed.data });
  } catch (err) {
    console.error("updateGymLoads failed", err);
    return { ok: false, error: GENERIC_ERROR };
  }
  revalidateGym();
  return { ok: true, savedAt: new Date().toISOString() };
}

/** Settings → Minha academia → Aparelhos (autosaved): the whole list of gear the gym doesn't have. */
export async function setMissingGear(ids: string[]): Promise<SettingsSaveResult> {
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return { ok: false, error: SESSION_EXPIRED_ERROR };
  const parsed = gearIdsSchema.safeParse(ids);
  if (!parsed.success) return { ok: false, error: GENERIC_ERROR };
  try {
    await prisma.profile.update({ where: { userId: user.id }, data: { missingGear: normalizeMissingGear(parsed.data) } });
  } catch (err) {
    console.error("setMissingGear failed", err);
    return { ok: false, error: GENERIC_ERROR };
  }
  revalidateGym();
  return { ok: true, savedAt: new Date().toISOString() };
}

/**
 * "Não tenho este aparelho" (workout, program): adds gear to — or, with
 * `missing: false` (Desfazer), takes it off — the gym's missing list, in one
 * statement per call so two taps from two screens never lose one another's
 * change. Returns the list as it now stands.
 */
export async function markGearMissing(ids: string[], missing = true): Promise<ActionResult<{ missingGear: string[] }>> {
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return { ok: false, error: SESSION_EXPIRED_ERROR };
  const parsed = gearIdsSchema.safeParse(ids);
  if (!parsed.success || parsed.data.length === 0) return { ok: false, error: GENERIC_ERROR };
  try {
    const next = await prisma.$transaction(async (tx) => {
      const [row] = await tx.$queryRaw<{ missingGear: string[] | null }[]>`
        SELECT "missingGear" FROM "Profile" WHERE "userId" = ${user.id} FOR UPDATE`;
      if (!row) return null;
      const current = new Set(row.missingGear ?? []);
      for (const id of parsed.data) {
        if (missing) current.add(id);
        else current.delete(id);
      }
      const list = normalizeMissingGear([...current]);
      await tx.profile.update({ where: { userId: user.id }, data: { missingGear: list } });
      return list;
    });
    if (!next) return { ok: false, error: GENERIC_ERROR };
    revalidateGym();
    return { ok: true, missingGear: next };
  } catch (err) {
    console.error("markGearMissing failed", err);
    return { ok: false, error: GENERIC_ERROR };
  }
}

/**
 * "Este aparelho sobe de…": the user's own load step for one exercise (a
 * machine with a 10 kg stack, a rack of 2,5 kg dumbbells), or null to follow
 * Settings → Minha academia again.
 */
export async function setExerciseLoadStep(exerciseId: string, stepKg: number | null): Promise<ActionResult> {
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return { ok: false, error: SESSION_EXPIRED_ERROR };
  const parsed = exerciseStepSchema.safeParse(stepKg);
  if (typeof exerciseId !== "string" || exerciseId.length === 0 || !parsed.success) return { ok: false, error: GENERIC_ERROR };
  try {
    const exists = await prisma.exercise.findFirst({ where: { id: exerciseId, isPublished: true }, select: { id: true } });
    if (!exists) return { ok: false, error: GENERIC_ERROR };
    if (parsed.data === null) {
      await prisma.exerciseLoadStep.deleteMany({ where: { userId: user.id, exerciseId } });
    } else {
      await prisma.exerciseLoadStep.upsert({
        where: { userId_exerciseId: { userId: user.id, exerciseId } },
        create: { userId: user.id, exerciseId, stepKg: parsed.data },
        update: { stepKg: parsed.data },
      });
    }
  } catch (err) {
    console.error("setExerciseLoadStep failed", err);
    return { ok: false, error: GENERIC_ERROR };
  }
  revalidatePath("/app/workout", "layout");
  revalidatePath(`/app/exercises`, "layout");
  return { ok: true };
}
