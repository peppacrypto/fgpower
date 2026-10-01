/**
 * Sign-in by e-mail (decision 13, D-D): one e-mail carrying a link to a
 * tap-to-confirm page AND a 6-digit code, built on better-auth's emailOTP
 * plugin. The rules that keep it narrow, pure so they are unit-tested:
 *
 * - only two plugin routes exist for the app — "send me a code" (type
 *   sign-in) and "sign in with it"; the plugin's other flows (verify e-mail,
 *   password reset, e-mail change, check-only) answer 404, and every one
 *   answers 404 while e-mail is off (production without Resend);
 * - the sign-in body carries the address and the code only: the plugin would
 *   otherwise take a `name`, an `image` URL or extra user fields from a new
 *   account's first request;
 * - a code dies after LOGIN_CODE_ATTEMPTS wrong tries; an address gets at
 *   most LOGIN_CODES_PER_HOUR / LOGIN_CODES_PER_DAY codes, and all addresses
 *   together a daily budget, so nobody can guess a code by asking for many or
 *   spend the provider's quota (the weekly digest shares it). The budgets
 *   count EmailMessage rows (lib/email/send.ts logs every send).
 */

export const LOGIN_CODE_LENGTH = 6;
/** Seconds a code (and the link carrying it) stays valid. */
export const LOGIN_CODE_TTL_SECONDS = 10 * 60;
/** Wrong tries before a code is dead (a new one must be asked for). */
export const LOGIN_CODE_ATTEMPTS = 3;
export const LOGIN_CODES_PER_HOUR = 5;
export const LOGIN_CODES_PER_DAY = 10;
/** All addresses together, per rolling 24 h, unless LOGIN_CODES_DAILY_BUDGET says otherwise. */
export const DEFAULT_LOGIN_CODES_DAILY_BUDGET = 80;

export const SEND_CODE_PATH = "/email-otp/send-verification-otp";
export const SIGN_IN_CODE_PATH = "/sign-in/email-otp";

/** The `code` of the 429 a budget refusal answers (the login form words each one). */
export const ADDRESS_LIMIT_CODE = "LOGIN_CODE_ADDRESS_LIMIT";
export const GLOBAL_LIMIT_CODE = "LOGIN_CODE_GLOBAL_LIMIT";

export type OtpGateVerdict = null | { status: "NOT_FOUND" } | { status: "BAD_REQUEST"; message: string };

/** Whether a better-auth path belongs to the emailOTP plugin (its routes live under two prefixes). */
export function isEmailOtpPath(path: string): boolean {
  return path.startsWith("/email-otp/") || path.endsWith("/email-otp");
}

/**
 * The before-hook's decision for one auth request: null lets it through
 * (every non-OTP route, and the two OTP routes while e-mail is on).
 */
export function emailOtpGate(path: string, body: unknown, emailOn: boolean): OtpGateVerdict {
  if (!isEmailOtpPath(path)) return null;
  if (!emailOn || (path !== SEND_CODE_PATH && path !== SIGN_IN_CODE_PATH)) return { status: "NOT_FOUND" };
  const fields = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  if (path === SEND_CODE_PATH) {
    if (fields.type !== "sign-in") return { status: "BAD_REQUEST", message: "Only sign-in codes are offered" };
    return null;
  }
  const extra = Object.keys(fields).filter((k) => k !== "email" && k !== "otp");
  if (extra.length > 0) return { status: "BAD_REQUEST", message: "Unexpected fields" };
  return null;
}

/** The daily budget for all addresses together (LOGIN_CODES_DAILY_BUDGET, a positive integer). */
export function loginCodesDailyBudget(raw: string | undefined = process.env.LOGIN_CODES_DAILY_BUDGET): number {
  const n = Number(raw?.trim());
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_LOGIN_CODES_DAILY_BUDGET;
}

/** Whether one more code may be sent, from the counts of codes already sent. */
export function loginCodeBudgetVerdict(counts: {
  addressLastHour: number;
  addressLastDay: number;
  allLastDay: number;
  dailyBudget: number;
}): "ok" | "address" | "global" {
  if (counts.addressLastHour >= LOGIN_CODES_PER_HOUR || counts.addressLastDay >= LOGIN_CODES_PER_DAY) return "address";
  if (counts.allLastDay >= counts.dailyBudget) return "global";
  return "ok";
}
