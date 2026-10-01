import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifySvix } from "@/lib/email/webhook";

export const dynamic = "force-dynamic";

/**
 * Resend's delivery events (optional; 404 until RESEND_WEBHOOK_SECRET is
 * set): a hard bounce or a spam complaint turns the digest off for that
 * address, so the sending domain keeps its reputation. Signed with Svix
 * (HMAC-SHA256 over "<id>.<timestamp>.<body>"), checked here without an SDK.
 */
export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = await request.text();
  if (!verifySvix(secret, request.headers, body)) return NextResponse.json({ error: "bad signature" }, { status: 401 });

  let event: { type?: string; data?: { email_id?: string; to?: string[]; bounce?: { type?: string } } };
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  const now = new Date();
  const hard = event.type === "email.bounced" && event.data?.bounce?.type !== "Transient";
  const complaint = event.type === "email.complained";
  if (hard || complaint) {
    const userIds = await usersOf(event.data?.email_id, event.data?.to ?? []);
    for (const userId of userIds) {
      await prisma.reminderPreference.upsert({
        where: { userId },
        create: {
          userId,
          emailDigest: false,
          ...(hard ? { emailBouncedAt: now } : { emailUnsubscribedAt: now }),
        },
        update: { emailDigest: false, ...(hard ? { emailBouncedAt: now } : { emailUnsubscribedAt: now }) },
      });
    }
  }
  return NextResponse.json({ ok: true });
}

async function usersOf(providerId: string | undefined, to: string[]): Promise<string[]> {
  if (providerId) {
    const message = await prisma.emailMessage.findFirst({ where: { providerId }, select: { userId: true } });
    if (message?.userId) return [message.userId];
  }
  const addresses = to.map((a) => a.trim().toLowerCase()).filter(Boolean).slice(0, 10);
  if (addresses.length === 0) return [];
  const users = await prisma.user.findMany({ where: { email: { in: addresses } }, select: { id: true } });
  return users.map((u) => u.id);
}
