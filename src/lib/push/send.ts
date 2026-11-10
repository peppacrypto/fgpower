import "server-only";
import webpush, { WebPushError } from "web-push";
import { prisma } from "@/lib/db";
import { pushTransport, vapidDetails } from "./config";
import { isAllowedPushEndpoint } from "./endpoint";

/**
 * Sends one notification to every device a user subscribed (W-017). Every
 * re-engagement push goes through the reminder engine (its caps and pause);
 * nothing else calls sendPushToUser. The one push outside it is the end of a
 * rest the user is resting (lib/push/rest-alert, sendPushToDevice): asked
 * for by that rest, to that one device, so it is no reminder — no caps, no
 * quiet hours, no delivery row. A device the push service says is gone (404/410)
 * is deleted; one that fails otherwise (429, 5xx, network) counts a failure
 * and is dropped by the engine's housekeeping after 5 with no success for 30
 * days. The text never carries loads or body data: it shows on a lock screen.
 */

export interface PushPayload {
  title: string;
  body: string;
  /** Where a tap goes: an app path (the tracked /r/<token>). */
  url: string;
  /** Replaces an earlier notification with the same tag on the device. */
  tag: string;
}

export interface PushOptions {
  /** Seconds the push service keeps it for an offline device. */
  ttlSeconds: number;
  /** Coalesces undelivered ones (≤ 32 URL-safe characters). */
  topic?: string;
  urgency?: "normal" | "high";
}

export interface PushResult {
  delivered: number;
  failed: number;
  removed: number;
}

const MAX_TITLE = 60;
const MAX_BODY = 240;
const SEND_TIMEOUT_MS = 10_000;

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** The JSON the service worker's push handler reads (public/sw.js): small, and only app paths. */
export function pushMessage(payload: PushPayload): string {
  return JSON.stringify({
    title: clip(payload.title, MAX_TITLE),
    body: clip(payload.body, MAX_BODY),
    url: payload.url.startsWith("/") && !payload.url.startsWith("//") ? payload.url : "/app/today",
    tag: payload.tag.slice(0, 64),
  });
}

type Device = { id: string; endpoint: string; p256dh: string; auth: string };

const DEVICE_SELECT = { id: true, endpoint: true, p256dh: true, auth: true } as const;

export async function sendPushToUser(userId: string, payload: PushPayload, opts: PushOptions): Promise<PushResult> {
  if (pushTransport() === "off") return { delivered: 0, failed: 0, removed: 0 };
  const devices = await prisma.pushSubscription.findMany({ where: { userId }, select: DEVICE_SELECT });
  return deliver(userId, devices, payload, opts);
}

/**
 * One notification to one of the user's devices, by its endpoint (the end of
 * a rest goes to the phone that rests, not to every device). Nothing is sent
 * when the endpoint is not, or no longer, one of the user's.
 */
export async function sendPushToDevice(
  userId: string,
  endpoint: string,
  payload: PushPayload,
  opts: PushOptions,
): Promise<PushResult> {
  if (pushTransport() === "off") return { delivered: 0, failed: 0, removed: 0 };
  const device = await prisma.pushSubscription.findFirst({ where: { userId, endpoint }, select: DEVICE_SELECT });
  return deliver(userId, device ? [device] : [], payload, opts);
}

async function deliver(userId: string, devices: Device[], payload: PushPayload, opts: PushOptions): Promise<PushResult> {
  const transport = pushTransport();
  const result: PushResult = { delivered: 0, failed: 0, removed: 0 };
  if (transport === "off" || devices.length === 0) return result;
  const message = pushMessage(payload);

  if (transport === "dev") {
    console.info("[push:dev]", userId, devices.length, message);
    return { ...result, delivered: devices.length };
  }

  const vapid = vapidDetails();
  if (!vapid) return result;
  const now = new Date();
  for (const device of devices) {
    // Stored rows were checked on write; check again before the server POSTs anywhere.
    if (!isAllowedPushEndpoint(device.endpoint)) {
      await prisma.pushSubscription.deleteMany({ where: { id: device.id } });
      result.removed += 1;
      continue;
    }
    try {
      await webpush.sendNotification(
        { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
        message,
        {
          vapidDetails: vapid,
          TTL: Math.max(60, Math.round(opts.ttlSeconds)),
          urgency: opts.urgency ?? "normal",
          ...(opts.topic ? { topic: opts.topic.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) } : {}),
          timeout: SEND_TIMEOUT_MS,
          contentEncoding: "aes128gcm",
        },
      );
      result.delivered += 1;
      await prisma.pushSubscription.update({ where: { id: device.id }, data: { lastSuccessAt: now, failureCount: 0 } });
    } catch (err) {
      const status = err instanceof WebPushError ? err.statusCode : 0;
      if (status === 404 || status === 410) {
        // The browser dropped it (unsubscribed, reinstalled, permission revoked).
        await prisma.pushSubscription.deleteMany({ where: { id: device.id } });
        result.removed += 1;
      } else {
        console.warn("[push] send failed", status || (err instanceof Error ? err.message : err));
        await prisma.pushSubscription
          .update({ where: { id: device.id }, data: { failureCount: { increment: 1 } } })
          .catch(() => undefined);
        result.failed += 1;
      }
    }
  }
  return result;
}
