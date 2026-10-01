import "server-only";
import { prisma } from "@/lib/db";
import { emailEnabled } from "@/lib/email/config";
import { verifyLink } from "@/lib/links/signed";
import { resumeData } from "./preferences";

/**
 * The digest's no-login unsubscribe (W-017): a signed "unsub" token names
 * the user; the link's page and the RFC 8058 one-click POST both end here.
 */

export async function digestStateForToken(token: string | null | undefined) {
  const data = verifyLink("unsub", token);
  if (!data) return null;
  const pref = await prisma.reminderPreference.findUnique({
    where: { userId: data.u },
    select: { emailDigest: true },
  });
  const exists = await prisma.user.count({ where: { id: data.u } });
  if (exists === 0) return null;
  return { userId: data.u, subscribed: pref?.emailDigest === true, canResubscribe: emailEnabled() };
}

export async function unsubscribeDigestByToken(token: string | null | undefined): Promise<boolean> {
  const data = verifyLink("unsub", token);
  if (!data) return false;
  const now = new Date();
  const res = await prisma.reminderPreference.updateMany({
    where: { userId: data.u },
    data: { emailDigest: false, emailUnsubscribedAt: now },
  });
  return res.count > 0 || (await prisma.user.count({ where: { id: data.u } })) > 0;
}

/** "Reativar resumo": opting in again, which also lifts a pause (like turning it on in Settings). */
export async function resubscribeDigestByToken(token: string | null | undefined): Promise<boolean> {
  const data = verifyLink("unsub", token);
  if (!data || !emailEnabled()) return false;
  const now = new Date();
  const user = await prisma.user.count({ where: { id: data.u } });
  if (user === 0) return false;
  const pref = await prisma.reminderPreference.findUnique({ where: { userId: data.u }, select: { pausedAt: true } });
  await prisma.reminderPreference.upsert({
    where: { userId: data.u },
    create: { userId: data.u, emailDigest: true, emailDigestOptInAt: now },
    update: {
      emailDigest: true,
      emailDigestOptInAt: now,
      emailUnsubscribedAt: null,
      emailBouncedAt: null,
      ...resumeData(now, pref?.pausedAt != null),
    },
  });
  return true;
}
