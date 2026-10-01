import "dotenv/config";
import { createHmac, randomBytes } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { POST } from "./route";

/**
 * Resend's webhook (W-017, optional): a Svix-signed hard bounce or complaint
 * turns that user's digest off; anything unsigned, stale or soft changes
 * nothing. Against the local Postgres.
 */

const TAG = `hook-${Date.now()}`;
const users = { bounce: `${TAG}-bounce`, complaint: `${TAG}-complaint`, soft: `${TAG}-soft` };
const email = (id: string) => `${id}@fgpower.test`;
const key = randomBytes(24);
const SECRET = `whsec_${key.toString("base64")}`;

function signed(event: unknown, opts: { key?: Buffer; ts?: number } = {}) {
  const body = JSON.stringify(event);
  const id = `msg_${Math.random().toString(36).slice(2)}`;
  const ts = String(opts.ts ?? Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", opts.key ?? key).update(`${id}.${ts}.${body}`).digest("base64");
  return new Request("http://localhost/api/email/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "svix-id": id, "svix-timestamp": ts, "svix-signature": `v1,${signature}` },
    body,
  });
}

const pref = (userId: string) =>
  prisma.reminderPreference.findUniqueOrThrow({
    where: { userId },
    select: { emailDigest: true, emailBouncedAt: true, emailUnsubscribedAt: true },
  });

beforeAll(async () => {
  for (const id of Object.values(users)) {
    await prisma.user.create({ data: { id, name: id, email: email(id), emailVerified: true } });
  }
  await prisma.emailMessage.create({
    data: { userId: users.bounce, toEmail: email(users.bounce), kind: "WEEKLY_DIGEST", subject: "x", transport: "resend", status: "SENT", providerId: `${TAG}-re-1` },
  });
});
beforeEach(async () => {
  for (const userId of Object.values(users)) {
    await prisma.reminderPreference.upsert({
      where: { userId },
      create: { userId, emailDigest: true },
      update: { emailDigest: true, emailBouncedAt: null, emailUnsubscribedAt: null },
    });
  }
  vi.stubEnv("RESEND_WEBHOOK_SECRET", SECRET);
});
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: Object.values(users) } } });
  await prisma.$disconnect();
});

describe("POST /api/email/webhook", () => {
  it("doesn't exist without RESEND_WEBHOOK_SECRET", async () => {
    vi.stubEnv("RESEND_WEBHOOK_SECRET", "");
    expect((await POST(signed({ type: "email.complained", data: { to: [email(users.complaint)] } }))).status).toBe(404);
  });

  it("refuses a wrong signature or a stale timestamp, and changes nothing", async () => {
    const event = { type: "email.complained", data: { to: [email(users.complaint)] } };
    expect((await POST(signed(event, { key: randomBytes(24) }))).status).toBe(401);
    expect((await POST(signed(event, { ts: Math.floor(Date.now() / 1000) - 10 * 60 }))).status).toBe(401);
    expect((await pref(users.complaint)).emailDigest).toBe(true);
  });

  it("a hard bounce (found by the message id) turns the digest off and marks the address", async () => {
    const res = await POST(signed({ type: "email.bounced", data: { email_id: `${TAG}-re-1`, to: ["someone-else@x.test"], bounce: { type: "Permanent" } } }));
    expect(res.status).toBe(200);
    const p = await pref(users.bounce);
    expect(p.emailDigest).toBe(false);
    expect(p.emailBouncedAt).not.toBeNull();
    expect(p.emailUnsubscribedAt).toBeNull();
  });

  it("a complaint (found by the address) unsubscribes", async () => {
    expect((await POST(signed({ type: "email.complained", data: { to: [email(users.complaint).toUpperCase()] } }))).status).toBe(200);
    const p = await pref(users.complaint);
    expect(p.emailDigest).toBe(false);
    expect(p.emailUnsubscribedAt).not.toBeNull();
  });

  it("a soft bounce or any other event changes nothing", async () => {
    await POST(signed({ type: "email.bounced", data: { to: [email(users.soft)], bounce: { type: "Transient" } } }));
    await POST(signed({ type: "email.delivered", data: { to: [email(users.soft)] } }));
    expect(await pref(users.soft)).toEqual({ emailDigest: true, emailBouncedAt: null, emailUnsubscribedAt: null });
  });
});
