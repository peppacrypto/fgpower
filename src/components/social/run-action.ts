/**
 * Client-side guard for calling a server action from an event handler or
 * transition. Actions report expected failures as `{ ok: false, error }`,
 * but the call itself can still reject (no signal, server crash, deploy in
 * between) — and a rejection inside startTransition would swap the whole
 * page for the error boundary, losing whatever the user typed. This turns
 * it into the same `{ ok: false, error }` shape so callers roll back inline.
 */

export const OFFLINE_ERROR = "Sem conexão. Tente de novo quando o sinal voltar.";
export const GENERIC_ACTION_ERROR = "Não foi possível concluir agora. Tente de novo.";

export type ActionFailure = { ok: false; error: string };

export function actionFailure(): ActionFailure {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  return { ok: false, error: offline ? OFFLINE_ERROR : GENERIC_ACTION_ERROR };
}

export async function runAction<T>(call: () => Promise<T>): Promise<T | ActionFailure> {
  try {
    return await call();
  } catch (err) {
    // warn, not error: an expected offline failure shouldn't raise the dev overlay.
    console.warn("server action failed", err);
    return actionFailure();
  }
}
