import { NextResponse } from "next/server";
import * as z from "zod";
import { isSameOrigin } from "@/app/api/workout/same-origin";
import { requireUserOrThrow } from "@/lib/auth/require-user";
import { SESSION_EXPIRED_ERROR } from "@/lib/auth/session-expired";
import { prisma } from "@/lib/db";
import { pushAvailable } from "@/lib/push/config";
import { MAX_ENDPOINT_LENGTH, isAllowedPushEndpoint } from "@/lib/push/endpoint";
import {
  REST_ALERT_MAX_DELAY_MS,
  REST_ALERT_MIN_DELAY_MS,
  restAlertPayload,
  restAlerts,
} from "@/lib/push/rest-alert";
import { sendPushToDevice } from "@/lib/push/send";

export const dynamic = "force-dynamic";

const seq = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

const postSchema = z.object({
  seq,
  sessionId: z.string().min(1).max(64),
  /** This device's push subscription: the alert goes to it alone. */
  endpoint: z.string().max(MAX_ENDPOINT_LENGTH).refine(isAllowedPushEndpoint),
  /** Time left in the rest, measured on the device (its clock may differ from ours). */
  inMs: z.number().int().min(REST_ALERT_MIN_DELAY_MS).max(REST_ALERT_MAX_DELAY_MS),
  kind: z.enum(["rest", "transition"]),
  next: z.string().max(400).nullable(),
});
const deleteSchema = z.object({ seq });

/**
 * The end of a rest as a notification (lib/push/rest-alert): POST schedules
 * it for this device at the rest's end, replacing the user's pending one;
 * DELETE takes it back (skipped, paused, cut short, the workout finished).
 * Only for a workout in progress, with Settings → Durante o treino's
 * "Notificação no fim do descanso" on, to a device the account subscribed
 * (404 tells the page this one isn't: its hint then shows how to turn it on).
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return NextResponse.json({ error: SESSION_EXPIRED_ERROR }, { status: 401 });
  if (!pushAvailable()) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const { sessionId, endpoint, inMs, kind, next } = parsed.data;

  const [device, session, profile] = await Promise.all([
    prisma.pushSubscription.findFirst({ where: { userId: user.id, endpoint }, select: { id: true } }),
    prisma.workoutSession.findFirst({
      where: { id: sessionId, userId: user.id, status: "IN_PROGRESS" },
      select: { id: true },
    }),
    prisma.profile.findUnique({ where: { userId: user.id }, select: { restEndNotification: true } }),
  ]);
  if (!device) return NextResponse.json({ error: "not-subscribed" }, { status: 404 });
  if (!session || profile?.restEndNotification === false) {
    restAlerts.cancel(user.id, parsed.data.seq);
    return NextResponse.json({ scheduled: false }, { status: 409 });
  }

  const userId = user.id;
  const payload = restAlertPayload({ sessionId, kind, next });
  const outcome = restAlerts.schedule(userId, parsed.data.seq, inMs, () =>
    // A rest's end is worth nothing a minute late: the push service drops it after that.
    sendPushToDevice(userId, endpoint, payload, { ttlSeconds: 60, urgency: "high", topic: "rest-end" }),
  );
  if (outcome === "full") return NextResponse.json({ scheduled: false }, { status: 429 });
  return NextResponse.json({ scheduled: outcome === "scheduled" });
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return NextResponse.json({ error: SESSION_EXPIRED_ERROR }, { status: 401 });
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  return NextResponse.json({ cancelled: restAlerts.cancel(user.id, parsed.data.seq) });
}
