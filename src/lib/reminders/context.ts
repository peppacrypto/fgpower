import "server-only";
import { prisma } from "@/lib/db";
import { getInProgressSessions, WELCOME_BACK_AFTER_DAYS } from "@/lib/data/dashboard";
import { getUpcomingPlan, type UpcomingPlan } from "@/lib/data/upcoming";
import { dayNumberOf, mondayOf, weekdayOfDayNo } from "@/lib/training/day-rotation";
import { startOfWeek, wallClock, zonedMidnight } from "@/lib/training/week";
import type { TrainingDayFacts } from "./copy";
import { getReminderPreference } from "./preferences";
import { spMinutes, type ReminderContext } from "./rules";

/**
 * Everything the engine decides one user's reminders from, at `now`: Today's
 * own plan (lib/data/upcoming — the same next workout, week and deload Today
 * shows, never re-derived here), what they did today, the reminders already
 * sent this week, and the facts the push copy needs.
 */

export interface LoadedReminderUser {
  ctx: ReminderContext;
  plan: UpcomingPlan;
  profile: { displayName: string; daysPerWeek: number; preferredDays: number[] } | null;
  email: string;
  /** The TRAINING_DAY copy's facts (null without a workout suggested today). */
  trainingDay: Omit<TrainingDayFacts, "welcomeBackAfterDays"> & { welcomeBackAfterDays: number } | null;
  /** Open workouts (Today's rows) by id, for OPEN_WORKOUT. */
  openWorkouts: Awaited<ReturnType<typeof getInProgressSessions>>;
}

export async function loadReminderUser(
  userId: string,
  now: Date,
  opts: { decidedOpenSessionIds?: ReadonlySet<string> } = {},
): Promise<LoadedReminderUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      profile: { select: { displayName: true, daysPerWeek: true, preferredDays: true } },
      _count: { select: { pushSubscriptions: true } },
    },
  });
  if (!user) return null;
  const profile = user.profile;
  const todayNo = dayNumberOf(now);
  const w = wallClock(now);
  const dayStart = zonedMidnight(w.year, w.month - 1, w.day);
  const [pref, plan, startedToday, sent, lastFinished] = await Promise.all([
    getReminderPreference(userId),
    getUpcomingPlan(userId, now, profile ? { daysPerWeek: profile.daysPerWeek, preferredDays: profile.preferredDays } : null),
    prisma.workoutSession.count({ where: { userId, startedAt: { gte: dayStart, lte: now } } }),
    prisma.reminderDelivery.findMany({
      where: { userId, status: "SENT", sentAt: { gte: startOfWeek(now), lte: now } },
      select: { sentAt: true },
    }),
    prisma.workoutSession.findFirst({
      where: { userId, status: "COMPLETED", finishedAt: { lte: now } },
      orderBy: { finishedAt: "desc" },
      select: { finishedAt: true },
    }),
  ]);
  const inProgress = plan.hasPlan ? plan.inProgress : await getInProgressSessions(userId, now);
  const decided = opts.decidedOpenSessionIds ?? new Set<string>();
  const open = inProgress.find((s) => s.hasData && s.lastActivityAt && !decided.has(s.id)) ?? null;
  const lastDoneNo = lastFinished?.finishedAt ? dayNumberOf(lastFinished.finishedAt) : null;

  const plannedDays: ReadonlySet<number> = plan.hasPlan ? plan.plannedDays : new Set(profile?.preferredDays ?? []);
  const enrollmentStartNo = plan.hasPlan ? dayNumberOf(plan.enrollment.startedAt) : null;
  const ctx: ReminderContext = {
    todayNo,
    minutes: spMinutes(now),
    paused: pref.pausedAt != null,
    pushHour: pref.pushHour,
    hasDevice: user._count.pushSubscriptions > 0,
    hasPlan: plan.hasPlan,
    plannedDays,
    enrollmentStartNo,
    deload: plan.hasPlan ? plan.deload : false,
    nextIsToday: plan.hasPlan ? plan.up.next?.isToday === true : false,
    restToday: plan.hasPlan ? plan.up.restToday : true,
    weekDone: plan.hasPlan ? plan.up.week.weekComplete || plan.rule.alreadyCounts : false,
    trainedToday: lastDoneNo === todayNo,
    startedToday: startedToday > 0,
    inProgress: inProgress.length > 0,
    openWorkout: open?.lastActivityAt
      ? { sessionId: open.id, startedNo: dayNumberOf(open.startedAt), lastActivityAt: open.lastActivityAt }
      : null,
    sentAt: sent.flatMap((s) => (s.sentAt ? [s.sentAt] : [])),
  };

  let trainingDay: LoadedReminderUser["trainingDay"] = null;
  if (plan.hasPlan && plan.up.next?.isToday) {
    const monday = mondayOf(todayNo);
    let plannedLeft = 0;
    for (let d = todayNo; d <= monday + 6; d++) if (plannedDays.has(weekdayOfDayNo(d))) plannedLeft += 1;
    const view = plan.weekView;
    trainingDay = {
      dayName: plan.up.next.day.name,
      exerciseCount: plan.up.next.day.exercises.length,
      daysSinceLast: lastDoneNo == null ? null : todayNo - lastDoneNo,
      welcomeBackAfterDays: WELCOME_BACK_AFTER_DAYS,
      streakCurrent: plan.habit.streak.current,
      remaining: plan.habit.streak.remaining,
      plannedLeft,
      program: {
        name: plan.enrollment.program.name,
        week: view.kind === "week" ? view.week : null,
        weeks: plan.enrollment.program.durationWeeks,
        entry: view.kind === "entry",
        rir: plan.guidance?.rirTarget ?? null,
      },
    };
  }

  return {
    ctx,
    plan,
    profile: profile ?? null,
    email: user.email,
    trainingDay,
    openWorkouts: inProgress,
  };
}
