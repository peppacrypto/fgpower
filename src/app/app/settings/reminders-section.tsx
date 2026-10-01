import { prisma } from "@/lib/db";
import { getUpcomingPlan } from "@/lib/data/upcoming";
import { emailEnabled } from "@/lib/email/config";
import { vapidPublicKey } from "@/lib/push/config";
import { pushDeviceKey } from "@/lib/push/device-key";
import { getReminderPreference } from "@/lib/reminders/preferences";
import { isPushHour, DEFAULT_PUSH_HOUR } from "@/lib/reminders/rules";
import { weekdaysLabel } from "@/lib/reminders/settings";
import { Section } from "./section";
import { RemindersForm } from "./reminders-form";

/**
 * Settings → "Lembretes" (id="lembretes", right after Rotina; W-017): Web
 * Push on this device, the hour, the weekly e-mail digest, the pause. An
 * async server component that renders its own <Section> — or nothing when
 * push and e-mail are both off (no dead switches).
 */
export async function RemindersSection({ userId }: { userId: string }) {
  const key = vapidPublicKey();
  const emailOn = emailEnabled();
  if (!key && !emailOn) return null;

  const [pref, devices, user, finished] = await Promise.all([
    getReminderPreference(userId),
    prisma.pushSubscription.findMany({ where: { userId }, select: { endpoint: true } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, profile: { select: { daysPerWeek: true, preferredDays: true } } },
    }),
    prisma.workoutSession.count({ where: { userId, status: "COMPLETED" }, take: 1 }),
  ]);
  if (!user) return null;
  const plan = await getUpcomingPlan(userId, new Date(), user.profile);
  const planned = plan.hasPlan ? plan.plannedDays : new Set(user.profile?.preferredDays ?? []);

  return (
    <Section id="lembretes" title="Lembretes">
      <RemindersForm
        push={
          key
            ? {
                vapidPublicKey: key,
                devices: devices.length,
                // The browser matches its own subscription against these (never the endpoints).
                deviceKeys: devices.map((d) => pushDeviceKey(d.endpoint)),
                unlocked: finished > 0,
              }
            : null
        }
        email={emailOn ? { address: user.email, bounced: pref.emailBouncedAt != null } : null}
        initial={{ hour: isPushHour(pref.pushHour) ? pref.pushHour : DEFAULT_PUSH_HOUR, emailDigest: pref.emailDigest }}
        pausedAt={pref.pausedAt ? pref.pausedAt.toISOString() : null}
        scheduleLabel={weekdaysLabel(planned)}
      />
    </Section>
  );
}
