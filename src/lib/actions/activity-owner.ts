"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/require-user";
import { SESSION_EXPIRED_ERROR } from "@/lib/auth/session-expired";
import { prisma } from "@/lib/db";
import type { ActionResult } from "./result";

/**
 * The owner's controls on a published workout (the activity page's "Quem vê"
 * and "Excluir publicação", W-143). Owned by the discovery cluster (C2).
 *
 * The rules they keep:
 * - owner only, WORKOUT activities only (stamps stay private);
 * - refuse an activity an admin hid (Activity.moderatedAt): "Esta publicação
 *   foi ocultada pela moderação.";
 * - the WorkoutSession's visibility follows, keeping its updatedAt (the 24 h
 *   correction window runs from the save);
 * - deleting keeps the workout in the history (session → PRIVATE); its FGs
 *   and notifications cascade, reports keep their snapshot;
 * - an expired session is { ok: false, error: SESSION_EXPIRED_ERROR }.
 */

type Visibility = "PRIVATE" | "FOLLOWERS" | "PUBLIC";
const VISIBILITIES: readonly Visibility[] = ["PRIVATE", "FOLLOWERS", "PUBLIC"];

const GONE = "Esta publicação não existe mais.";
const NOT_YOURS = "Só quem publicou pode mudar esta publicação.";
const NOT_A_WORKOUT = "Só publicações de treino podem ser alteradas.";
const MODERATED = "Esta publicação foi ocultada pela moderação.";
const FAILED = "Não foi possível salvar agora. Tente de novo.";

type OwnedWorkout = { id: string; userId: string; type: string; sessionId: string | null; moderatedAt: Date | null };

/** The activity when the user may change it, else the error to show. */
async function ownedWorkout(userId: string, activityId: string): Promise<{ activity: OwnedWorkout } | { error: string }> {
  if (typeof activityId !== "string" || activityId.length === 0 || activityId.length > 64) return { error: GONE };
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { id: true, userId: true, type: true, sessionId: true, moderatedAt: true },
  });
  if (!activity) return { error: GONE };
  if (activity.userId !== userId) return { error: NOT_YOURS };
  if (activity.type !== "WORKOUT") return { error: NOT_A_WORKOUT };
  if (activity.moderatedAt) return { error: MODERATED };
  return { activity };
}

/**
 * Why a write found nothing to change: the post was hidden by moderation or
 * deleted after ownedWorkout read it.
 */
async function lostRace(userId: string, activityId: string): Promise<string> {
  const again = await ownedWorkout(userId, activityId);
  return "error" in again ? again.error : FAILED;
}

function revalidateActivity(activityId: string, sessionId: string | null) {
  revalidatePath("/app/feed");
  revalidatePath(`/app/activity/${activityId}`);
  // A route pattern names the file path, route group included (Next's revalidatePath docs).
  revalidatePath("/(public)/u/[username]", "page");
  if (sessionId) revalidatePath(`/app/workout/${sessionId}/summary`);
}

/** "Quem vê" on the activity page: Privado · Seguidores · Público, saved on change. */
export async function setActivityVisibility(
  activityId: string,
  visibility: Visibility,
): Promise<ActionResult<{ visibility: Visibility }>> {
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return { ok: false, error: SESSION_EXPIRED_ERROR };
  if (!VISIBILITIES.includes(visibility)) return { ok: false, error: FAILED };

  try {
    const found = await ownedWorkout(user.id, activityId);
    if ("error" in found) return { ok: false, error: found.error };
    const { activity } = found;
    const changed = await prisma.$transaction(async (tx) => {
      // Still unmoderated at the write: an admin's "Ocultar treino" that lands
      // after the read above wins, instead of being published again here.
      const { count } = await tx.activity.updateMany({
        where: { id: activity.id, userId: user.id, moderatedAt: null },
        data: { visibility, updatedAt: new Date() },
      });
      if (count === 0) return false;
      if (activity.sessionId) {
        const session = await tx.workoutSession.findUnique({
          where: { id: activity.sessionId },
          select: { updatedAt: true },
        });
        // updatedAt as it was: who sees the workout isn't an edit of it.
        if (session) {
          await tx.workoutSession.update({
            where: { id: activity.sessionId },
            data: { visibility, updatedAt: session.updatedAt },
          });
        }
      }
      return true;
    });
    if (!changed) return { ok: false, error: await lostRace(user.id, activity.id) };
    revalidateActivity(activity.id, activity.sessionId);
    return { ok: true, visibility };
  } catch (err) {
    console.error("setActivityVisibility failed", err);
    return { ok: false, error: FAILED };
  }
}

/**
 * "Excluir publicação": the post goes (its FGs and their notifications with
 * it); the workout stays in the history, private.
 */
export async function deleteActivity(activityId: string): Promise<ActionResult> {
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return { ok: false, error: SESSION_EXPIRED_ERROR };

  try {
    const found = await ownedWorkout(user.id, activityId);
    if ("error" in found) return { ok: false, error: found.error };
    const { activity } = found;
    const deleted = await prisma.$transaction(async (tx) => {
      // Only while still unmoderated: a post an admin hid after the read above stays, as moderation left it.
      const { count } = await tx.activity.deleteMany({ where: { id: activity.id, userId: user.id, moderatedAt: null } });
      if (count === 0) return false;
      if (activity.sessionId) {
        const session = await tx.workoutSession.findUnique({
          where: { id: activity.sessionId },
          select: { updatedAt: true },
        });
        if (session) {
          await tx.workoutSession.update({
            where: { id: activity.sessionId },
            data: { visibility: "PRIVATE", updatedAt: session.updatedAt },
          });
        }
      }
      return true;
    });
    // Gone meanwhile (another tab's tap) or hidden by moderation: say which.
    if (!deleted) return { ok: false, error: await lostRace(user.id, activity.id) };
    revalidateActivity(activity.id, activity.sessionId);
    return { ok: true };
  } catch (err) {
    console.error("deleteActivity failed", err);
    return { ok: false, error: FAILED };
  }
}
