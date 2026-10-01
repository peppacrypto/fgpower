import "dotenv/config";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { checkLoginCodeBudget, sendLoginCodeEmail } from "./login-code";

/** Sign-in code budgets and the sign-in e-mail against the real local Postgres (EmailMessage log). */

const RUN_MS = Date.now();
const TAG = `login-${RUN_MS}`;
const address = (label: string) => `${TAG}-${label}@fgpower.test`;
const DAY_MS = 86_400_000;

/**
 * The clock the all-addresses budget is checked at. That budget counts every
 * address's codes since a day before it, with no upper bound, and at the real
 * clock the ones other test files send (and clean up) meanwhile moved the count
 * under the test. This day is far ahead of the real one and at least two days
 * past every code already logged, a killed run's leftovers included, so it
 * holds only the codes logged for it here. The spread (one of 1,000 days two
 * apart, picked by this run's start) keeps a run started at the same time off
 * the same day.
 */
async function farNow(): Promise<Date> {
  const { _max } = await prisma.emailMessage.aggregate({ where: { kind: "LOGIN_CODE" }, _max: { createdAt: true } });
  const past = Math.max(Date.UTC(2200, 0, 1), _max.createdAt?.getTime() ?? 0);
  return new Date(past + (1 + (RUN_MS % 1000)) * 2 * DAY_MS);
}

afterEach(() => vi.unstubAllEnvs());
afterAll(async () => {
  await prisma.emailMessage.deleteMany({ where: { toEmail: { startsWith: TAG } } });
  await prisma.$disconnect();
});

async function logCodes(to: string, n: number, minutesAgo: number, now = new Date()) {
  for (let i = 0; i < n; i++) {
    await prisma.emailMessage.create({
      data: {
        toEmail: to,
        kind: "LOGIN_CODE",
        subject: "Código",
        transport: "dev",
        status: "LOGGED",
        createdAt: new Date(now.getTime() - minutesAgo * 60_000),
      },
    });
  }
}

describe("sign-in codes", () => {
  it("per address: 5 an hour, 10 a day", async () => {
    const a = address("hour");
    await logCodes(a, 4, 10);
    expect(await checkLoginCodeBudget(a)).toBe("ok");
    await logCodes(a, 1, 5);
    expect(await checkLoginCodeBudget(a.toUpperCase())).toBe("address");

    const b = address("day");
    await logCodes(b, 9, 180);
    expect(await checkLoginCodeBudget(b)).toBe("ok");
    await logCodes(b, 1, 120);
    expect(await checkLoginCodeBudget(b)).toBe("address");
  });

  it("all addresses: a daily budget, only against a real provider", async () => {
    const now = await farNow();
    // Other addresses' codes in the day before `now`: 3 of them; one more, a day and an hour before, doesn't count.
    await logCodes(address("other-a"), 2, 30, now);
    await logCodes(address("other-b"), 1, 23 * 60, now);
    await logCodes(address("other-b"), 1, 25 * 60, now);
    vi.stubEnv("LOGIN_CODES_DAILY_BUDGET", "3");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("EMAIL_TRANSPORT", "");
    vi.stubEnv("RESEND_API_KEY", "");
    expect(await checkLoginCodeBudget(address("fresh"), now)).toBe("ok"); // dev transport: no global budget
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "FGPOWER <acesso@fgpower.monster>");
    expect(await checkLoginCodeBudget(address("fresh"), now)).toBe("global");
    vi.stubEnv("LOGIN_CODES_DAILY_BUDGET", "4");
    expect(await checkLoginCodeBudget(address("fresh"), now)).toBe("ok");
  });

  it("the e-mail: logged by the dev transport with the link and the spaced code (never the code in the subject); never throws", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("EMAIL_TRANSPORT", "");
    vi.stubEnv("RESEND_API_KEY", "");
    const to = address("mail");
    await sendLoginCodeEmail({ email: to.toUpperCase(), otp: "482913", next: "/app/programs" });
    const row = await prisma.emailMessage.findFirstOrThrow({ where: { toEmail: to } });
    // The log outlives the code by 30 days: its subject never holds it (the dev body is dev only).
    expect(row).toMatchObject({ kind: "LOGIN_CODE", subject: "Código de acesso FGPOWER: ••••••", status: "LOGGED" });
    expect(row.devBody).toContain("482 913");
    expect(row.devBody).toMatch(/\/login\/link#e=.+&c=482913&next=%2Fapp%2Fprograms/);

    vi.stubEnv("EMAIL_TRANSPORT", "off");
    await expect(sendLoginCodeEmail({ email: address("off"), otp: "111111", next: null })).resolves.toBeUndefined();
  });
});
