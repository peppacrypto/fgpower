"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";

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
