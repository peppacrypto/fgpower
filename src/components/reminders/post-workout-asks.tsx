import { prisma } from "@/lib/db";
import { emailEnabled } from "@/lib/email/config";
import { vapidPublicKey } from "@/lib/push/config";
import { getUpcomingPlan } from "@/lib/data/upcoming";
import { getReminderPreference } from "@/lib/reminders/preferences";
import { hourLabel, weekdaysLabel } from "@/lib/reminders/settings";
import { PostWorkoutAskSwitch, type ReminderAskOffer } from "./reminder-ask";

/** A dismissed ask comes back once, this long after "Agora não"… */
const ASK_AGAIN_AFTER_MS = 30 * 86_400_000;
/** …and after this many more finished workouts. */
const ASK_AGAIN_AFTER_WORKOUTS = 5;

/**
 * The one ask after a fresh workout (decision 8, W-017): the reminders ask
 * ("Lembrar você nos dias de treino?", with the e-mail digest checkbox when
 * e-mail is on) or the install card — never both. An async server component
 * that loads its own eligibility, so the summary only places it: last on the
 * page, for the latest workout. The device's own abilities (an iPhone outside
 * the installed app, a blocked permission) are judged on the client.
 *
 * Eligible when: push or e-mail is available, the user isn't paused, has no
 * device subscribed, and was never asked — or said "Agora não" once, over 30
 * days and 5 workouts ago.
 *
 * Always the same client component, eligible or not: answering makes the
 * user ineligible at once (a device, askCount + 1), and a server re-render
 * right after (a revalidation, or the session cookie refreshed inside any
 * action) must leave the confirmation where it is, not swap in the install
 * card. The client keeps the ask it was first served.
 */
export async function PostWorkoutAsks({
  userId,
  finishedWorkouts,
  className,
}: {
  userId: string;
  /** The workout's ordinal ("Treino nº N"): the install card waits for the first few. */
  finishedWorkouts: number;
  className?: string;
}) {
  const ask = await askOffer(userId).catch((err) => {
    console.error("[reminders] ask eligibility failed", err);
    return null;
  });
  return (
    <PostWorkoutAskSwitch
      ask={ask}
      finishedWorkouts={finishedWorkouts}
      answerKey={`${userId}:${finishedWorkouts}`}
      className={className}
    />
  );
}

async function askOffer(userId: string): Promise<ReminderAskOffer | null> {
  const key = vapidPublicKey();
  const emailOn = emailEnabled();
  if (!key && !emailOn) return null;
  const [pref, devices, user] = await Promise.all([
    getReminderPreference(userId),
    prisma.pushSubscription.count({ where: { userId } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, profile: { select: { daysPerWeek: true, preferredDays: true } } },
    }),
  ]);
  if (!user || pref.pausedAt != null || devices > 0 || pref.askCount >= 2) return null;
  if (pref.askCount === 1) {
    const since = pref.askDismissedAt;
    if (!since || Date.now() - since.getTime() < ASK_AGAIN_AFTER_MS) return null;
    const workoutsSince = await prisma.workoutSession.count({
      where: { userId, status: "COMPLETED", finishedAt: { gt: since } },
    });
    if (workoutsSince < ASK_AGAIN_AFTER_WORKOUTS) return null;
  }
  const digestOffer = emailOn && !pref.emailDigest && pref.emailBouncedAt == null ? { address: user.email } : null;
  if (!key && !digestOffer) return null;
  const plan = await getUpcomingPlan(userId, new Date(), user.profile);
  const planned = plan.hasPlan ? plan.plannedDays : new Set(user.profile?.preferredDays ?? []);
  return {
    push: key ? { vapidPublicKey: key } : null,
    email: digestOffer,
    scheduleLabel: weekdaysLabel(planned),
    hour: hourLabel(pref.pushHour),
  };
}
