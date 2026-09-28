"use server";

import { requireUserOrThrow } from "@/lib/auth/require-user";
import { SESSION_EXPIRED_ERROR } from "@/lib/auth/session-expired";
import type { ActionResult } from "./result";

/**
 * The owner's controls on a published workout (the activity page's "Quem vê"
 * and "Excluir publicação", W-143). Owned by the discovery cluster (C2).
 *
 * Phase 0 stubs with the final signatures. The rules they must keep:
 * - owner only, WORKOUT activities only (stamps stay private);
 * - refuse an activity an admin hid (Activity.moderatedAt): "Esta publicação
 *   foi ocultada pela moderação.";
 * - the WorkoutSession's visibility follows, keeping its updatedAt (the 24 h
 *   correction window runs from the save);
 * - deleting keeps the workout in the history (session → PRIVATE); its FGs
 *   and notifications cascade, reports keep their snapshot;
 * - an expired session is { ok: false, error: SESSION_EXPIRED_ERROR }.
 */

const NOT_YET = "Não disponível ainda.";

type Visibility = "PRIVATE" | "FOLLOWERS" | "PUBLIC";

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Phase 0 stub (C2 implements W-143)
export async function setActivityVisibility(activityId: string, visibility: Visibility): Promise<ActionResult<{ visibility: Visibility }>> {
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return { ok: false, error: SESSION_EXPIRED_ERROR };
  return { ok: false, error: NOT_YET };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Phase 0 stub (C2 implements W-143)
export async function deleteActivity(activityId: string): Promise<ActionResult> {
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return { ok: false, error: SESSION_EXPIRED_ERROR };
  return { ok: false, error: NOT_YET };
}
