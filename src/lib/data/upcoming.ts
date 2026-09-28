import "server-only";
import {
  getActiveEnrollment,
  getDaysDoneThisWeek,
  getInProgressSessions,
  getTodayHabit,
  type ActiveEnrollment,
} from "@/lib/data/dashboard";
import { resolveSessionDay } from "@/lib/training/day-match";
import {
  dayNumberOf,
  mondayOf,
  plannedWeekdays,
  repeatsDays,
  upcomingWorkout,
  type Upcoming,
} from "@/lib/training/day-rotation";
import { effectiveDeload, isAppliedDeload } from "@/lib/training/deload";
import {
  completeWeekDone,
  effectiveProgramWeek,
  getWeekGuidance,
  programWeekView,
  thisWeekRule,
  type ProgramWeekView,
  type ThisWeekRule,
  type WeekGuidanceView,
} from "@/lib/training/week-guidance";
import { trainingWeekdays } from "@/lib/programming/schedule";

/**
 * Today's plan, available outside a page: the active program's week — the
 * next workout and its date, this week's count and rule, the program week
 * and its guidance, deload (planned or applied), the user's training
 * weekdays — computed with Today's loaders and rules (day-rotation
 * upcomingWorkout, week-guidance). The workout summary's "Próximo treino"
 * maps it (summary-data nextUp); the reminder engine, the weekly digest and
 * the fatigue signal read it, so none of them re-derives Today.
 *
 * Unlike Today it reads no per-device choice (the week-start cookie): the
 * same answer for every device, the summary's since Batch 3.
 */

type ProgramDay = ActiveEnrollment["program"]["days"][number];

export type UpcomingPlan =
  | {
      /** No active program, or one without a day with exercises: no next workout. */
      hasPlan: false;
      enrollment: ActiveEnrollment | null;
      todayNo: number;
    }
  | {
      hasPlan: true;
      enrollment: ActiveEnrollment;
      /** São Paulo day number of `now`. */
      todayNo: number;
      /** The streak, the last workout and the program's week facts (dashboard getTodayHabit). */
      habit: Awaited<ReturnType<typeof getTodayHabit>>;
      /** Every workout in progress (Today's rows). */
      inProgress: Awaited<ReturnType<typeof getInProgressSessions>>;
      /** Days of this program with a workout still open. */
      openDayIds: Set<string>;
      /** This week's done days of the program (getDaysDoneThisWeek). */
      done: Awaited<ReturnType<typeof getDaysDoneThisWeek>>;
      /** The program week the next workout counts in, or the Thursday–Sunday entry week. */
      weekView: ProgramWeekView;
      /** That week's guidance (RIR target, notes; deload/test flags), as Today shows it. */
      guidance: WeekGuidanceView | null;
      /** A deload week — planned (guidance) or applied by the user (lib/training/deload). */
      deload: boolean;
      /** The user applied a deload to this calendar week ("Aplicar deload"). */
      appliedDeload: boolean;
      rule: ThisWeekRule;
      /** planWeek's input for this week (days, done, open days skipped). */
      weekInput: {
        days: ProgramDay[];
        isTrainable: (d: ProgramDay) => boolean;
        nextDayIndex: number;
        daysPerWeek: number;
        doneDayIds: Map<string, string>;
        sessionCount: number;
        skipDayIds: Set<string>;
      };
      /** The week's plan and the next workout with its suggested date. */
      up: Upcoming<ProgramDay>;
      /** Weekdays (0 = Sunday) the user trains on — Today's plannedWeekdays. */
      plannedDays: Set<number>;
    };

export async function getUpcomingPlan(
  userId: string,
  now: Date,
  profile: { daysPerWeek: number; preferredDays: number[] } | null,
): Promise<UpcomingPlan> {
  const todayNo = dayNumberOf(now);
  const enrollment = await getActiveEnrollment(userId);
  const days = enrollment?.program.days ?? [];
  const isTrainable = (d: ProgramDay) => d.exercises.length > 0;
  if (!enrollment || !days.some(isTrainable)) return { hasPlan: false, enrollment, todayNo };

  const [done, inProgress, habit] = await Promise.all([
    getDaysDoneThisWeek(userId, enrollment.id, days),
    getInProgressSessions(userId, now),
    getTodayHabit(userId, enrollment, now),
  ]);
  const own = habit.program;
  // Days of this program with a workout still open (as Today's day rows map them).
  const openDayIds = new Set(
    inProgress
      .filter((s) => s.programId === enrollment.programId)
      .flatMap((s) => resolveSessionDay(s, days)?.id ?? []),
  );
  const daysPerWeek = enrollment.program.daysPerWeek;
  const weekView = programWeekView({
    startedAt: enrollment.startedAt,
    now,
    effectiveWeek: effectiveProgramWeek({
      currentWeek: enrollment.currentWeek,
      sessionsThisWeek: done.sessionCount,
      trainedBefore: own?.trainedBefore ?? false,
    }),
    entryWeekTrained: own?.entryWeekTrained ?? false,
  });
  const guidance = getWeekGuidance(enrollment.program.weeklyGuidance, weekView.guidanceWeek, {
    templateSlug: enrollment.program.sourceTemplate?.slug ?? null,
    durationWeeks: enrollment.program.durationWeeks,
  });
  const monday = mondayOf(todayNo);
  const rule = thisWeekRule({ view: weekView, enrollmentId: enrollment.id, thisWeek: habit.streak.thisWeek });
  const preferredDays = profile?.preferredDays ?? [];
  // The user's week: the days' planned weekdays; a plan that repeats its days
  // (A/B at 3×) is trained on the profile's days (programming/schedule).
  const schedule = repeatsDays(daysPerWeek, days.length) ? trainingWeekdays(daysPerWeek, preferredDays) : preferredDays;
  const weekInput = {
    days,
    isTrainable,
    nextDayIndex: enrollment.nextDayIndex,
    daysPerWeek,
    doneDayIds: done.byDayId,
    sessionCount: done.sessionCount,
    skipDayIds: openDayIds,
  };
  const up = upcomingWorkout({
    ...weekInput,
    // A week that already counts: nothing is asked of it — the next workout is next week's first.
    ...(rule.alreadyCounts ? completeWeekDone(days.filter(isTrainable).map((d) => d.id)) : {}),
    targetCap: rule.targetCap,
    todayNo,
    lastDoneNo: habit.lastSession ? dayNumberOf(habit.lastSession.finishedAt) : null,
    preferredDays: schedule,
    // Next week's start as Today judges it (dashboard getTodayHabit → day-rotation weekStartChoice).
    carryOverNextWeek: own?.nextWeekCarryOver ?? false,
  });

  return {
    hasPlan: true,
    enrollment,
    todayNo,
    habit,
    inProgress,
    openDayIds,
    done,
    weekView,
    guidance,
    deload: effectiveDeload(guidance?.deload, enrollment.deloadMondays, monday),
    appliedDeload: isAppliedDeload(enrollment.deloadMondays, monday),
    rule,
    weekInput,
    up,
    plannedDays: plannedWeekdays(days.filter(isTrainable), schedule),
  };
}
