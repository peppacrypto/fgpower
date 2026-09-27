import { safeNextPath } from "./safe-next";

/**
 * What an action says when its caller's session is gone (30 days away, or
 * signed out on another device). Clients recognise it by prefix and add an
 * "Entrar" link that comes back to the same page (see SessionExpiredNote).
 */
export const SESSION_EXPIRED_ERROR = "Sua sessão expirou — entre de novo.";

export function isSessionExpiredError(error: string | null | undefined): boolean {
  return Boolean(error?.startsWith(SESSION_EXPIRED_ERROR));
}

/** `?sessao=expirada` makes /login explain why the user is there. */
export const SESSION_EXPIRED_PARAM = "sessao";
export const SESSION_EXPIRED_VALUE = "expirada";

/** Sign-in link that returns to `path` (when it's an app page) and says the session expired. */
export function loginAgainHref(path: string | null | undefined): string {
  const params = new URLSearchParams();
  const next = safeNextPath(path);
  if (next) params.set("next", next);
  params.set(SESSION_EXPIRED_PARAM, SESSION_EXPIRED_VALUE);
  return `/login?${params.toString()}`;
}
