"use server";

import { redirect } from "next/navigation";
import { resubscribeDigestByToken, unsubscribeDigestByToken } from "@/lib/reminders/unsubscribe";

/**
 * The unsubscribe page's two buttons. No session: the signed token is the
 * permission. Each goes back to the page, which reads the new state.
 */

function back(token: string, done: string) {
  redirect(`/email/cancelar?t=${encodeURIComponent(token)}&feito=${done}`);
}

export async function unsubscribeDigest(formData: FormData) {
  const token = String(formData.get("t") ?? "");
  const ok = await unsubscribeDigestByToken(token);
  back(token, ok ? "cancelado" : "erro");
}

export async function resubscribeDigest(formData: FormData) {
  const token = String(formData.get("t") ?? "");
  const ok = await resubscribeDigestByToken(token);
  back(token, ok ? "reativado" : "erro");
}
