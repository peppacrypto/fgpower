import "dotenv/config";
import { EventEmitter } from "node:events";
import { createDecipheriv, createECDH, createHmac, createPublicKey, randomBytes, verify } from "node:crypto";
import type { ClientRequest, IncomingMessage } from "node:http";
import https from "node:https";
import webpush from "web-push";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { pushMessage, sendPushToUser } from "./send";

/**
 * The real Web Push request, up to the push service (R4): sendPushToUser →
 * web-push, with only the HTTPS call to the push service faked. The request
 * is then checked the way a push service and a browser would, independently
 * of web-push: the VAPID JWT's ES256 signature and claims (RFC 8292), and the
 * aes128gcm body decrypted with the subscriber's own keys (RFC 8291/8188).
 */

const USER = `webpush-${Date.now()}`;
const ENDPOINT = `https://fcm.googleapis.com/fcm/send/${USER}`;
const SUBJECT = "mailto:admin@fgpower.monster";
const payload = { title: "Hoje: Segunda — Superior", body: "GD 1 · Semana 2 de 13 · RIR alvo 2 · 6 exercícios", url: "/r/abc.def", tag: "fg-day-x" };

// The browser's side of the subscription.
const browser = createECDH("prime256v1");
browser.generateKeys();
const authSecret = randomBytes(16);
const vapid = webpush.generateVAPIDKeys();

interface Captured {
  options: https.RequestOptions;
  body: Buffer;
}

/** Stands in for the push service: records each request and answers `status`. */
function fakePushService(status: number) {
  const calls: Captured[] = [];
  vi.spyOn(https, "request").mockImplementation(((options: https.RequestOptions, onResponse: (res: IncomingMessage) => void) => {
    const chunks: Buffer[] = [];
    const req = Object.assign(new EventEmitter(), {
      write(chunk: Buffer) {
        chunks.push(Buffer.from(chunk));
        return true;
      },
      end() {
        calls.push({ options, body: Buffer.concat(chunks) });
        const res = Object.assign(new EventEmitter(), { statusCode: status, headers: {} });
        setImmediate(() => {
          onResponse(res as unknown as IncomingMessage);
          res.emit("end");
        });
      },
      destroy() {},
    });
    return req as unknown as ClientRequest;
  }) as unknown as typeof https.request);
  return calls;
}

const b64url = (b: Buffer) => b.toString("base64url");
const hmac = (key: Buffer, data: Buffer) => createHmac("sha256", key).update(data).digest();

/** RFC 8291 + RFC 8188 (one record): what the browser does with an aes128gcm push. */
function decrypt(body: Buffer): string {
  const salt = body.subarray(0, 16);
  const idlen = body[20];
  const serverKey = body.subarray(21, 21 + idlen);
  const record = body.subarray(21 + idlen);
  const shared = browser.computeSecret(serverKey);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), browser.getPublicKey(), serverKey]);
  const ikm = hmac(hmac(authSecret, shared), Buffer.concat([keyInfo, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from("Content-Encoding: aes128gcm\0\x01", "binary")).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from("Content-Encoding: nonce\0\x01", "binary")).subarray(0, 12);
  const decipher = createDecipheriv("aes-128-gcm", cek, nonce);
  decipher.setAuthTag(record.subarray(record.length - 16));
  const padded = Buffer.concat([decipher.update(record.subarray(0, record.length - 16)), decipher.final()]);
  // Content, then the last-record delimiter 0x02, then zero padding.
  let end = padded.length - 1;
  while (end >= 0 && padded[end] === 0) end--;
  expect(padded[end]).toBe(2);
  return padded.subarray(0, end).toString("utf8");
}

beforeAll(async () => {
  await prisma.user.create({ data: { id: USER, name: USER, email: `${USER}@fgpower.test`, emailVerified: true } });
  await prisma.pushSubscription.create({
    data: { userId: USER, endpoint: ENDPOINT, p256dh: b64url(browser.getPublicKey()), auth: b64url(authSecret) },
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: USER } });
  await prisma.$disconnect();
});

describe("a reminder push as it leaves the server", () => {
  it("is VAPID-signed for the push service and decrypts, on the device, to the message", async () => {
    vi.stubEnv("PUSH_TRANSPORT", "");
    vi.stubEnv("VAPID_PUBLIC_KEY", vapid.publicKey);
    vi.stubEnv("VAPID_PRIVATE_KEY", vapid.privateKey);
    vi.stubEnv("VAPID_SUBJECT", SUBJECT);
    const calls = fakePushService(201);

    const result = await sendPushToUser(USER, payload, { ttlSeconds: 3600, topic: "training-day", urgency: "normal" });
    expect(result).toEqual({ delivered: 1, failed: 0, removed: 0 });
    expect(calls).toHaveLength(1);
    const { options, body } = calls[0];
    expect(options).toMatchObject({ method: "POST", hostname: "fcm.googleapis.com", path: `/fcm/send/${USER}` });
    const headers = options.headers as Record<string, string | number>;
    expect(headers).toMatchObject({
      TTL: 3600,
      Urgency: "normal",
      Topic: "training-day",
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
    });

    // VAPID (RFC 8292): "vapid t=<ES256 JWT>, k=<the public key>", for this push service's origin.
    const auth = String(headers.Authorization);
    const [, token, key] = auth.match(/^vapid t=([^,]+), k=(\S+)$/) ?? [];
    expect(key).toBe(vapid.publicKey);
    const [h, p, s] = token.split(".");
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual({ typ: "JWT", alg: "ES256" });
    const claims = JSON.parse(Buffer.from(p, "base64url").toString()) as { aud: string; exp: number; sub: string };
    expect(claims.aud).toBe("https://fcm.googleapis.com");
    expect(claims.sub).toBe(SUBJECT);
    const nowS = Date.now() / 1000;
    expect(claims.exp).toBeGreaterThan(nowS);
    expect(claims.exp).toBeLessThanOrEqual(nowS + 24 * 3600);
    const point = Buffer.from(vapid.publicKey, "base64url");
    const publicKey = createPublicKey({
      key: { kty: "EC", crv: "P-256", x: b64url(point.subarray(1, 33)), y: b64url(point.subarray(33, 65)) },
      format: "jwk",
    });
    expect(verify("sha256", Buffer.from(`${h}.${p}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url"))).toBe(true);

    // The body: only the subscriber's keys open it, and it is exactly what the worker reads.
    expect(body.length).toBeLessThan(3 * 1024);
    expect(decrypt(body)).toBe(pushMessage(payload));
    const row = await prisma.pushSubscription.findUniqueOrThrow({ where: { endpoint: ENDPOINT } });
    expect(row.lastSuccessAt).not.toBeNull();
  });

  it("a push service that says the subscription is gone (410) removes the device", async () => {
    vi.stubEnv("PUSH_TRANSPORT", "");
    vi.stubEnv("VAPID_PUBLIC_KEY", vapid.publicKey);
    vi.stubEnv("VAPID_PRIVATE_KEY", vapid.privateKey);
    vi.stubEnv("VAPID_SUBJECT", SUBJECT);
    fakePushService(410);
    expect(await sendPushToUser(USER, payload, { ttlSeconds: 60 })).toEqual({ delivered: 0, failed: 0, removed: 1 });
    expect(await prisma.pushSubscription.count({ where: { userId: USER } })).toBe(0);
  });
});
