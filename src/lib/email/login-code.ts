import "server-only";
import { appOrigin } from "@/lib/app-origin";
import { prisma } from "@/lib/db";
import { emailTransport } from "./config";
import { loginCodeBudgetVerdict, loginCodesDailyBudget } from "./login-gate";
import { sendEmail } from "./send";
import { LOGIN_CODE_LOG_SUBJECT, loginCodeEmail } from "./templates/login-code";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Whether one more sign-in code may go to `email` (login-gate budgets), from
 * the EmailMessage log: this address in the last hour and day, and every
 * address in the last day. Checked before the plugin even creates the code.
 * The all-addresses budget guards the provider's quota, so the dev
 * transport (nothing leaves the machine) has none.
 */
export async function checkLoginCodeBudget(email: string, now: Date = new Date()): Promise<"ok" | "address" | "global"> {
  const to = email.trim().toLowerCase();
  const dayAgo = new Date(now.getTime() - DAY_MS);
  const [addressLastHour, addressLastDay, allLastDay] = await Promise.all([
    prisma.emailMessage.count({
      where: { toEmail: to, kind: "LOGIN_CODE", createdAt: { gt: new Date(now.getTime() - HOUR_MS) } },
    }),
    prisma.emailMessage.count({ where: { toEmail: to, kind: "LOGIN_CODE", createdAt: { gt: dayAgo } } }),
    prisma.emailMessage.count({ where: { kind: "LOGIN_CODE", createdAt: { gt: dayAgo } } }),
  ]);
  const dailyBudget = emailTransport() === "resend" ? loginCodesDailyBudget() : Number.POSITIVE_INFINITY;
  return loginCodeBudgetVerdict({ addressLastHour, addressLastDay, allLastDay, dailyBudget });
}

/**
 * Sends the sign-in e-mail (the plugin's sendVerificationOTP). Never throws:
 * a failure is logged (EmailMessage FAILED) and the request still answers
 * success, so the response time and body say nothing about the address.
 */
export async function sendLoginCodeEmail(p: { email: string; otp: string; next: string | null }): Promise<void> {
  try {
    const email = p.email.trim().toLowerCase();
    const message = loginCodeEmail({ email, otp: p.otp, next: p.next, origin: appOrigin() });
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    const result = await sendEmail({
      ...message,
      to: email,
      kind: "LOGIN_CODE",
      userId: user?.id ?? null,
      idempotencyKey: `login:${email}:${p.otp}`,
      logSubject: LOGIN_CODE_LOG_SUBJECT,
    });
    if (!result.ok) console.error("[login-code] not sent", result.error);
  } catch (err) {
    console.error("[login-code] failed", err);
  }
}
