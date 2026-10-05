"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { requireUserOrThrow } from "@/lib/auth/require-user";
import { SESSION_EXPIRED_ERROR } from "@/lib/auth/session-expired";

/**
 * "Sair da conta" (Configurações → Dados e conta). Signs out on the server:
 * better-auth drops the session row and, through nextCookies(), the session
 * cookies — even when the session was already gone. The caller then leaves
 * for /login with a full page load, so nothing of the account stays in the
 * client's router cache. Done on the server so no page ships the auth client for it.
 */
export async function signOutAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await auth.api.signOut({ headers: await headers() });
    return { ok: true };
  } catch (err) {
    console.error("sign-out failed", err);
    return { ok: false, error: "Não foi possível sair agora. Tente de novo." };
  }
}

/**
 * "Sair dos outros aparelhos" (Configurações → Dados e conta, A-044). Ends the
 * session on every other device the account is signed in on — a lost phone, a
 * shared computer — while keeping this one: better-auth's revokeOtherSessions
 * deletes every session token except the caller's own, so this device needs no
 * re-login and the page is not swapped out. The 90-day renewing cookie elsewhere
 * is the point (decision 14); this is its missing kill switch. Done on the
 * server (like signOutAction) so no page ships the auth client for it. A dead
 * session here reports SESSION_EXPIRED_ERROR, which the caller turns into an
 * "Entrar" link instead of a retry that can't succeed.
 */
export async function signOutOtherDevicesAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return { ok: false, error: SESSION_EXPIRED_ERROR };
  try {
    await auth.api.revokeOtherSessions({ headers: await headers() });
    return { ok: true };
  } catch (err) {
    console.error("sign-out-other-devices failed", err);
    return { ok: false, error: "Não foi possível desconectar os outros aparelhos agora. Tente de novo." };
  }
}
