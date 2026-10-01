import "server-only";
import { appUrl } from "@/lib/app-origin";
import { prisma } from "@/lib/db";
import { getLastWeekReview } from "@/lib/data/dashboard";
import { COMPLETED_BLOCK_WINDOW_MS, describeCompletedBlock } from "@/lib/data/program-lifecycle";
import { getWeeklyStreak } from "@/lib/data/streak-data";
import { signLink } from "@/lib/links/signed";
import { weekdayOfDayNo } from "@/lib/training/day-rotation";
import { weeklyDigestEmail, type DigestData } from "@/lib/email/templates/weekly-digest";
import type { LoadedReminderUser } from "./context";
import { weekdaysLabel } from "./settings";

/**
 * The weekly digest's facts for one user (W-017 §6): last week from the
 * streak and the Monday review, this week from Today's plan. Reads only —
 * a block past its last week is described, never closed from here.
 */

/** Tracked tap (/r/<token>) for a delivery, going on to `to`. */
export function clickUrl(userId: string, deliveryId: string, to: string): string {
  return appUrl(`/r/${signLink("click", { u: userId, d: deliveryId, to })}`);
}

export function unsubscribeToken(userId: string): string {
  return signLink("unsub", { u: userId });
}

export async function buildDigest(user: LoadedReminderUser, userId: string, deliveryId: string, now: Date) {
  const { plan, ctx } = user;
  const [streak, review] = await Promise.all([getWeeklyStreak(userId, now), getLastWeekReview(userId, now)]);

  let program: DigestData["program"] = null;
  let block: DigestData["block"] = null;
  if (plan.hasPlan) {
    const view = plan.weekView;
    const todayIsTraining = plan.up.next?.isToday === true && plan.plannedDays.has(weekdayOfDayNo(ctx.todayNo));
    program = {
      name: plan.enrollment.program.name,
      week: view.kind === "week" ? view.week : null,
      weeks: plan.enrollment.program.durationWeeks,
      entry: view.kind === "entry",
      test: plan.guidance?.test === true,
      rir: plan.guidance?.rirTarget ?? null,
      note: plan.guidance?.notePt ?? null,
      days: weekdaysLabel(plan.plannedDays),
      today:
        todayIsTraining && plan.up.next
          ? { name: plan.up.next.day.name, exerciseCount: plan.up.next.day.exercises.length }
          : null,
    };
  } else if (!plan.enrollment) {
    const done = await prisma.programEnrollment.findFirst({
      where: { userId, status: "COMPLETED", endedAt: { gte: new Date(now.getTime() - COMPLETED_BLOCK_WINDOW_MS), lte: now } },
      orderBy: { endedAt: "desc" },
      select: { id: true },
    });
    const described = done ? await describeCompletedBlock(userId, done.id) : null;
    if (described) block = { name: described.programName, nextName: described.next?.name ?? null };
  }

  const lastWeek = streak.lastWeek;
  const data: DigestData = {
    firstName: user.profile?.displayName.trim().split(/\s+/)[0] || null,
    todayNo: ctx.todayNo,
    lastWeek: lastWeek
      ? { done: lastWeek.done, target: lastWeek.target, met: lastWeek.met, deload: lastWeek.deload === true }
      : null,
    streak: { current: streak.current, best: streak.best },
    records: review.recordExercises.map((e) => e.namePt),
    muscles: review.muscles.slice(0, 3).map((m) => ({ name: m.name, sets: m.sets })),
    program,
    block,
    urls: {
      cta: clickUrl(userId, deliveryId, "/app/today"),
      unsubscribe: appUrl(`/email/cancelar?t=${unsubscribeToken(userId)}`),
      preferences: clickUrl(userId, deliveryId, "/app/settings#lembretes"),
    },
  };
  return weeklyDigestEmail(data);
}

/** RFC 8058 one-click unsubscribe headers (Gmail/Apple Mail "Cancelar inscrição"). */
export function digestHeaders(userId: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${appUrl(`/api/email/unsubscribe?t=${unsubscribeToken(userId)}`)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
