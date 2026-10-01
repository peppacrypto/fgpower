import { ADDRESS_LIMIT_CODE, GLOBAL_LIMIT_CODE } from "@/lib/email/login-gate";

/**
 * pt-BR copy for what better-auth answers the e-mail sign-in calls
 * (`{ error: { status, code } }`), shared by the login form and the link's
 * confirm page. Offline is judged on the device, before anything else.
 */

export const OFFLINE_TEXT = "Sem conexão. Tente de novo quando o sinal voltar.";

/**
 * A suspended account (moderation's ban): better-auth refuses its session with
 * this code — to the e-mail code, and as `?error=BANNED_USER` to Google's
 * return. Saying so beats a "tente de novo" that can never work.
 */
export const BANNED_CODE = "BANNED_USER";
export const BANNED_TEXT = "Esta conta está suspensa e não pode entrar.";

export function isBanned(error: AuthCallError | null | undefined): boolean {
  return error?.code === BANNED_CODE;
}

/**
 * better-auth sends a failed Google sign-in back to /login with `?error=<code>`:
 * `access_denied` when the user backs out of Google's consent screen,
 * BANNED_USER when the account is suspended. What the page says, and the code
 * it prints under it (short snake_case only; anything else reads "erro").
 */
export function oauthErrorView(raw: string | null | undefined): { text: string; code: string | null } | null {
  if (!raw) return null;
  if (raw === BANNED_CODE) return { text: BANNED_TEXT, code: null };
  if (raw === "access_denied") return { text: "O login com o Google foi cancelado. Tente de novo quando quiser.", code: null };
  return {
    text: "Não foi possível entrar com o Google. Tente de novo em instantes.",
    code: /^[a-z0-9_]{1,64}$/.test(raw) ? raw : "erro",
  };
}

export interface AuthCallError {
  status?: number;
  code?: string;
}

export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/** Asking for a code. */
export function sendCodeErrorText(error: AuthCallError | null | undefined): string {
  if (isOffline()) return OFFLINE_TEXT;
  if (error?.code === "INVALID_EMAIL") return "Confira o e-mail digitado.";
  if (error?.code === ADDRESS_LIMIT_CODE) {
    return "Você já pediu muitos códigos para este e-mail. Tente de novo mais tarde ou entre com o Google.";
  }
  if (error?.code === GLOBAL_LIMIT_CODE) {
    return "O acesso por e-mail está pausado agora. Entre com o Google ou tente de novo mais tarde.";
  }
  if (error?.status === 429) return "Muitas tentativas. Espere um minuto e tente de novo.";
  return "Não foi possível enviar agora. Tente de novo.";
}

/** Signing in with a code typed in the form. */
export function signInErrorText(error: AuthCallError | null | undefined): string {
  if (isOffline()) return OFFLINE_TEXT;
  if (error?.code === "INVALID_OTP") return "Código incorreto. Confira e tente de novo.";
  if (error?.code === "OTP_EXPIRED") return "Este código expirou. Peça um novo.";
  if (error?.code === "TOO_MANY_ATTEMPTS") return "Muitas tentativas com este código. Peça um novo.";
  if (isBanned(error)) return BANNED_TEXT;
  if (error?.status === 429) return "Muitas tentativas. Espere um minuto e tente de novo.";
  return "Não foi possível entrar agora. Tente de novo.";
}

/** The code can't work any more: only a new link helps (the confirm page's dead end). */
export function isDeadCode(error: AuthCallError | null | undefined): boolean {
  return error?.code === "INVALID_OTP" || error?.code === "OTP_EXPIRED" || error?.code === "TOO_MANY_ATTEMPTS";
}
