import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runReminderTick } from "@/lib/reminders/engine";
import { sendPushToUser, type PushPayload, type PushResult } from "@/lib/push/send";

export const dynamic = "force-dynamic";

/**
 * Dev/test-only reminder tick for ONE user (e2e): `POST { userId, now?, dry?,
 * realPush? }`. Pushes go through a fake transport (e2e devices are stubs)
 * unless `realPush` (a real browser subscription, verified by hand); e-mails
 * through the dev transport. 404 in production, like /api/test/login.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as { userId?: unknown; now?: unknown; dry?: unknown; realPush?: unknown };
  if (typeof body.userId !== "string" || !body.userId) return NextResponse.json({ error: "userId" }, { status: 400 });
  const now = typeof body.now === "string" ? new Date(body.now) : new Date();
  if (Number.isNaN(now.getTime())) return NextResponse.json({ error: "now" }, { status: 400 });

  const fakePush = async (userId: string, payload: PushPayload): Promise<PushResult> => {
    const devices = await prisma.pushSubscription.count({ where: { userId } });
    console.info("[push:test]", userId, devices, payload.title);
    return { delivered: devices, failed: 0, removed: 0 };
  };
  const summary = await runReminderTick(now, {
    onlyUserIds: [body.userId],
    dryRun: body.dry === true,
    sendPush: body.realPush === true ? sendPushToUser : fakePush,
    emailPacingMs: 0,
  });
  return NextResponse.json(summary, { headers: { "cache-control": "no-store" } });
}
