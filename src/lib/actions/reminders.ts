"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/require-user";
import { SESSION_EXPIRED_ERROR } from "@/lib/auth/session-expired";
import { prisma } from "@/lib/db";
import { emailEnabled } from "@/lib/email/config";
import { getReminderPreference, resumeData } from "@/lib/reminders/preferences";
import { reminderSettingsSchema, type ReminderSettings } from "@/lib/reminders/settings";
import type { ActionResult, SettingsSaveResult } from "./result";

const GENERIC_ERROR = "Não foi possível salvar agora. Tente de novo.";
const EMAIL_OFF_ERROR = "O resumo por e-mail está indisponível no momento.";

/**
 * Reminder settings (W-017): Settings → Lembretes and the post-workout ask.
 * Every action answers the shared session-expired result when the session
 * is gone (D-L). Turning something on counts as opting in again: it lifts a
 * pause. Devices are added and removed by /api/push/subscriptions.
 */

/** Settings → Lembretes: the push hour and the weekly digest (autosaved as one block). */
export async function updateReminderSettings(settings: ReminderSettings): Promise<SettingsSaveResult> {
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return { ok: false, error: SESSION_EXPIRED_ERROR };
  const parsed = reminderSettingsSchema.safeParse(settings);
  if (!parsed.success) return { ok: false, error: GENERIC_ERROR };
  const { hour, emailDigest } = parsed.data;
  try {
    const pref = await getReminderPreference(user.id);
    if (emailDigest && !pref.emailDigest && !emailEnabled()) return { ok: false, error: EMAIL_OFF_ERROR };
    const now = new Date();
    const turningOn = emailDigest && !pref.emailDigest;
    const data = {
      pushHour: hour,
      emailDigest,
      ...(turningOn ? { emailDigestOptInAt: now, emailUnsubscribedAt: null, emailBouncedAt: null } : {}),
      ...(turningOn ? resumeData(now, pref.pausedAt != null) : {}),
      ...(!emailDigest && pref.emailDigest ? { emailUnsubscribedAt: now } : {}),
    };
    await prisma.reminderPreference.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
  } catch (err) {
    console.error("updateReminderSettings failed", err);
    return { ok: false, error: GENERIC_ERROR };
  }
  revalidatePath("/app/settings");
  return { ok: true, savedAt: new Date().toISOString() };
}

/** "Retomar agora" on the paused banner. */
export async function resumeReminders(): Promise<ActionResult> {
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return { ok: false, error: SESSION_EXPIRED_ERROR };
  try {
    await prisma.reminderPreference.updateMany({
      where: { userId: user.id, pausedAt: { not: null } },
      data: { pausedAt: null, pausedReason: null, resumedAt: new Date() },
    });
  } catch (err) {
    console.error("resumeReminders failed", err);
    return { ok: false, error: GENERIC_ERROR };
  }
  revalidatePath("/app/settings");
  return { ok: true };
}

/** "Agora não" on the post-workout ask: asked again at most once, a month and 5 workouts later. */
export async function dismissReminderAsk(): Promise<ActionResult> {
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return { ok: false, error: SESSION_EXPIRED_ERROR };
  try {
    const now = new Date();
    await prisma.reminderPreference.upsert({
      where: { userId: user.id },
      create: { userId: user.id, askDismissedAt: now, askCount: 1 },
      update: { askDismissedAt: now, askCount: { increment: 1 } },
    });
  } catch (err) {
    console.error("dismissReminderAsk failed", err);
    return { ok: false, error: GENERIC_ERROR };
  }
  return { ok: true };
}

/**
 * The post-workout ask answered yes (push already on for this device): records
 * the answer, and turns the digest on when its checkbox was ticked (D-C).
 */
export async function acceptReminderAsk(p: { emailDigest: boolean }): Promise<ActionResult> {
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return { ok: false, error: SESSION_EXPIRED_ERROR };
  const digest = p?.emailDigest === true;
  if (digest && !emailEnabled()) return { ok: false, error: EMAIL_OFF_ERROR };
  try {
    const now = new Date();
    const pref = await getReminderPreference(user.id);
    const data = {
      askCount: pref.askCount + 1,
      ...(digest ? { emailDigest: true, emailDigestOptInAt: now, emailUnsubscribedAt: null, emailBouncedAt: null } : {}),
      ...resumeData(now, pref.pausedAt != null),
    };
    await prisma.reminderPreference.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
  } catch (err) {
    console.error("acceptReminderAsk failed", err);
    return { ok: false, error: GENERIC_ERROR };
  }
  // No revalidation: Settings is rendered per request, and nothing on the
  // summary changes (its ask keeps its own confirmation — PostWorkoutAskSwitch).
  return { ok: true };
}

/** The ask's e-mail variant (no push on this browser): "Quero o resumo". */
export async function acceptEmailDigest(): Promise<ActionResult> {
  return acceptReminderAsk({ emailDigest: true });
}
