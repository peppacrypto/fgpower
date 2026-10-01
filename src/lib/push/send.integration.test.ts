import "dotenv/config";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const { sendNotification } = vi.hoisted(() => ({ sendNotification: vi.fn() }));
vi.mock("web-push", async () => {
  const actual = await vi.importActual<typeof import("web-push")>("web-push");
  return { ...actual, default: { ...actual, sendNotification }, sendNotification };
});

import { WebPushError } from "web-push";
import { prisma } from "@/lib/db";
import { pushMessage, sendPushToUser } from "./send";

/** sendPushToUser against the real local Postgres, with the push service mocked. */

const USER = `push-${Date.now()}`;
const device = (n: number) => `https://fcm.googleapis.com/fcm/send/${USER}-${n}`;

beforeAll(async () => {
  await prisma.user.create({ data: { id: USER, name: USER, email: `${USER}@fgpower.test`, emailVerified: true } });
});
afterEach(() => {
  vi.unstubAllEnvs();
  sendNotification.mockReset();
});
afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: USER } });
  await prisma.$disconnect();
});

const payload = { title: "Hoje: Sessão A", body: "GD 1 · Semana 5 de 13", url: "/r/abc.def", tag: "fg-day-x" };

describe("sendPushToUser", () => {
  it("delivers to every device, drops the gone ones, counts the failures", async () => {
    vi.stubEnv("PUSH_TRANSPORT", "");
    vi.stubEnv("VAPID_PUBLIC_KEY", "BExamplePublicKey");
    vi.stubEnv("VAPID_PRIVATE_KEY", "examplePrivateKey");
    vi.stubEnv("VAPID_SUBJECT", "mailto:admin@fgpower.monster");
    for (const n of [1, 2, 3]) {
      await prisma.pushSubscription.create({
        data: { userId: USER, endpoint: device(n), p256dh: "B".repeat(87), auth: "a".repeat(22), failureCount: n === 1 ? 2 : 0 },
      });
    }
    sendNotification.mockImplementation(async (sub: { endpoint: string }) => {
      if (sub.endpoint === device(2)) throw new WebPushError("gone", 410, {}, "", sub.endpoint);
      if (sub.endpoint === device(3)) throw new WebPushError("busy", 503, {}, "", sub.endpoint);
      return { statusCode: 201, body: "", headers: {} };
    });

    const result = await sendPushToUser(USER, payload, { ttlSeconds: 3600, topic: "training-day" });
    expect(result).toEqual({ delivered: 1, failed: 1, removed: 1 });
    const [, message, options] = sendNotification.mock.calls[0];
    expect(JSON.parse(message)).toEqual(payload);
    expect(options).toMatchObject({ TTL: 3600, topic: "training-day", urgency: "normal" });
    expect(options.vapidDetails.subject).toBe("mailto:admin@fgpower.monster");
    const left = await prisma.pushSubscription.findMany({ where: { userId: USER }, orderBy: { endpoint: "asc" } });
    expect(left.map((d) => [d.endpoint, d.failureCount, d.lastSuccessAt != null])).toEqual([
      [device(1), 0, true],
      [device(3), 1, false],
    ]);
  });

  it("off, or no devices: sends nothing", async () => {
    vi.stubEnv("PUSH_TRANSPORT", "off");
    expect(await sendPushToUser(USER, payload, { ttlSeconds: 60 })).toEqual({ delivered: 0, failed: 0, removed: 0 });
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("the message: short, app paths only", () => {
    const m = JSON.parse(pushMessage({ ...payload, url: "https://evil.com/x", body: "x".repeat(500) }));
    expect(m.url).toBe("/app/today");
    expect(m.body.length).toBeLessThanOrEqual(240);
    expect(JSON.parse(pushMessage({ ...payload, url: "//evil.com" })).url).toBe("/app/today");
  });
});
