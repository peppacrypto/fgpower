import "dotenv/config";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { sendEmail } from "./send";

/** sendEmail's transports against the real local Postgres (the EmailMessage log). */

const TAG = `mail-${Date.now()}`;
const address = (label: string) => `${TAG}-${label}@fgpower.test`;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

afterAll(async () => {
  await prisma.emailMessage.deleteMany({ where: { toEmail: { startsWith: TAG } } });
  await prisma.$disconnect();
});

const message = (to: string) => ({
  to,
  subject: "Código de acesso FGPOWER: 482913",
  html: "<p>482 913</p>",
  text: "482 913",
  kind: "LOGIN_CODE" as const,
});

describe("sendEmail", () => {
  it("dev transport: logs the message with its body, sends nothing", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_TRANSPORT", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const to = address("dev");
    const result = await sendEmail(message(` ${to.toUpperCase()} `));
    expect(result.ok).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    const row = await prisma.emailMessage.findFirstOrThrow({ where: { toEmail: to } });
    expect(row).toMatchObject({ kind: "LOGIN_CODE", transport: "dev", status: "LOGGED", devBody: "482 913" });
  });

  it("off: sends and logs nothing", async () => {
    vi.stubEnv("EMAIL_TRANSPORT", "off");
    const to = address("off");
    expect(await sendEmail(message(to))).toEqual({ ok: false, error: "EMAIL_OFF" });
    expect(await prisma.emailMessage.count({ where: { toEmail: to } })).toBe(0);
  });

  it("resend: posts to the REST API and logs SENT without the body", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("EMAIL_FROM", "FGPOWER <acesso@fgpower.monster>");
    vi.stubEnv("EMAIL_TRANSPORT", "");
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ id: "re_123" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    const to = address("resend");
    const result = await sendEmail({ ...message(to), idempotencyKey: `login:${to}:482913`, headers: { "X-Test": "1" } });
    expect(result).toEqual({ ok: true, id: "re_123" });
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer re_test_key");
    expect(headers["idempotency-key"]).toBe(`login:${to}:482913`);
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      from: "FGPOWER <acesso@fgpower.monster>",
      to: [to],
      text: "482 913",
      headers: { "X-Test": "1" },
      tags: [{ name: "kind", value: "LOGIN_CODE" }],
    });
    const row = await prisma.emailMessage.findFirstOrThrow({ where: { toEmail: to } });
    expect(row).toMatchObject({ transport: "resend", status: "SENT", providerId: "re_123", devBody: null });
  });

  it("resend: a provider error is a FAILED row, never a throw", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("EMAIL_FROM", "FGPOWER <acesso@fgpower.monster>");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("rate limited", { status: 429 })));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const to = address("fail");
    const result = await sendEmail(message(to));
    expect(result.ok).toBe(false);
    const row = await prisma.emailMessage.findFirstOrThrow({ where: { toEmail: to } });
    expect(row.status).toBe("FAILED");
    expect(row.error).toContain("429");
    errorSpy.mockRestore();
  });
});
