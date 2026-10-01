import "server-only";
import { prisma } from "@/lib/db";
import { DEFAULT_PUSH_HOUR } from "./rules";

/**
 * Per-user reminder settings (ReminderPreference), created lazily on the
 * first opt-in (a device subscribed, the digest turned on, the post-workout
 * ask answered). Absent, the defaults apply: 18h, no digest, not paused.
 */

export const PREFERENCE_DEFAULTS = {
  pushHour: DEFAULT_PUSH_HOUR,
  emailDigest: false,
  emailUnsubscribedAt: null,
  emailBouncedAt: null,
  pausedAt: null,
  pausedReason: null,
  resumedAt: null,
  askDismissedAt: null,
  askCount: 0,
} as const;

export async function getReminderPreference(userId: string) {
  const row = await prisma.reminderPreference.findUnique({ where: { userId } });
  return row ?? { userId, ...PREFERENCE_DEFAULTS };
}

/** An opt-in lifts a pause (and restarts the ignored count from now). */
export function resumeData(now: Date, paused: boolean) {
  return paused ? { pausedAt: null, pausedReason: null, resumedAt: now } : {};
}
