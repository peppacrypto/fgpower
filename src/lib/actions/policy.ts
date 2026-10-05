"use server";

import { requireUserOrThrow } from "@/lib/auth/require-user";
import { SESSION_EXPIRED_ERROR } from "@/lib/auth/session-expired";
import { prisma } from "@/lib/db";
import { POLICY_VERSION } from "@/lib/legal/policy";
import type { ActionResult } from "./result";

/**
 * A-054 — records that the signed-in user has acknowledged the current policy
 * version (the Today re-acknowledge notice's "Entendi"). Idempotent.
 *
 * [OWNER/LEGAL: where consent is the legal basis for a given processing, a
 * version bump must RE-CONSENT, not merely dismiss — confirm scope with counsel
 * and extend this to re-stamp healthDataConsent* when that applies.]
 */
export async function acknowledgePolicy(): Promise<ActionResult> {
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return { ok: false, error: SESSION_EXPIRED_ERROR };
  try {
    await prisma.profile.update({
      where: { userId: user.id },
      data: { acknowledgedPolicyVersion: POLICY_VERSION },
    });
  } catch (err) {
    console.error("acknowledgePolicy failed", err);
    return { ok: false, error: "Não foi possível salvar agora. Tente de novo." };
  }
  return { ok: true };
}
