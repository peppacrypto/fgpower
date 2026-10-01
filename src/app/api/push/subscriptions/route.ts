import { NextResponse } from "next/server";
import * as z from "zod";
import { isSameOrigin } from "@/app/api/workout/same-origin";
import { requireUserOrThrow } from "@/lib/auth/require-user";
import { SESSION_EXPIRED_ERROR } from "@/lib/auth/session-expired";
import { prisma } from "@/lib/db";
import { pushAvailable } from "@/lib/push/config";
import { pushSubscriptionSchema } from "@/lib/push/endpoint";
import { getReminderPreference, resumeData } from "@/lib/reminders/preferences";

export const dynamic = "force-dynamic";

/** Devices a user keeps; subscribing an 11th drops the oldest. */
const MAX_DEVICES = 10;

const postSchema = z.object({
  subscription: pushSubscriptionSchema,
  /** The endpoint this one replaces (the service worker's pushsubscriptionchange). */
  replaces: z.string().max(2048).nullish(),
});
const deleteSchema = z.union([z.object({ endpoint: z.string().max(2048) }), z.object({ all: z.literal(true) })]);

/**
 * This browser's Web Push subscription for reminders (W-017). POST saves it
 * (allow-listed push services only — the server later POSTs to it), DELETE
 * removes this device or all of them. Turning push on counts as opting in
 * again: it lifts a pause. Available after the first finished workout
 * (decision 8: the first ask comes after a workout).
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return NextResponse.json({ error: SESSION_EXPIRED_ERROR }, { status: 401 });
  if (!pushAvailable()) return NextResponse.json({ error: "Notificações indisponíveis." }, { status: 503 });
  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Este navegador não é compatível." }, { status: 400 });
  const finished = await prisma.workoutSession.count({ where: { userId: user.id, status: "COMPLETED" }, take: 1 });
  if (finished === 0) {
    return NextResponse.json({ error: "Disponível depois do seu primeiro treino." }, { status: 409 });
  }

  const { subscription, replaces } = parsed.data;
  const now = new Date();
  const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? null;
  const pref = await getReminderPreference(user.id);
  const devices = await prisma.$transaction(async (tx) => {
    // One browser, one row: signing in with another account on it moves the device over.
    await tx.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: {
        userId: user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent,
      },
      update: {
        userId: user.id,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent,
        failureCount: 0,
      },
    });
    if (replaces && replaces !== subscription.endpoint) {
      await tx.pushSubscription.deleteMany({ where: { userId: user.id, endpoint: replaces } });
    }
    const extra = await tx.pushSubscription.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      skip: MAX_DEVICES,
      select: { id: true },
    });
    if (extra.length > 0) await tx.pushSubscription.deleteMany({ where: { id: { in: extra.map((d) => d.id) } } });
    await tx.reminderPreference.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: resumeData(now, pref.pausedAt != null),
    });
    return tx.pushSubscription.count({ where: { userId: user.id } });
  });
  return NextResponse.json({ ok: true, devices });
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return NextResponse.json({ error: SESSION_EXPIRED_ERROR }, { status: 401 });
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  await prisma.pushSubscription.deleteMany({
    where: { userId: user.id, ...("endpoint" in parsed.data ? { endpoint: parsed.data.endpoint } : {}) },
  });
  const devices = await prisma.pushSubscription.count({ where: { userId: user.id } });
  return NextResponse.json({ ok: true, devices });
}
