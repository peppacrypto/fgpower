"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/require-user";
import { SESSION_EXPIRED_ERROR } from "@/lib/auth/session-expired";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/lib/actions/result";
import { getUpcomingPlan } from "@/lib/data/upcoming";
import { fatigueDismissalKey, getFatigueSignal, inDeloadCooldown } from "@/lib/data/fatigue";
import { dayNumberOf, mondayOf } from "@/lib/training/day-rotation";
import { startOfWeek } from "@/lib/training/week";

/**
 * "Aplicar deload nesta semana" / "Desfazer" (W-128, decision 16): the app
 * never applies a deload by itself. Applying writes this São Paulo week's
 * Monday into ProgramEnrollment.deloadMondays — nothing else: the workouts
 * started from then on in the week open with half the sets and a raised RIR
 * (workouts.ts openSessionForDay), and every deload reader follows
 * (lib/training/deload effectiveDeload). Finished workouts are never touched.
 * Undoing is possible until a workout is started under it.
 */

const ID = /^[\w-]{1,64}$/;

/** The week key the card was drawn for must be this week's (a card left open over a Monday is stale). */
function thisWeekKey(now: Date) {
  return String(mondayOf(dayNumberOf(now)));
}

const STALE_WEEK = "Esta sugestão era da semana passada. Abra Hoje de novo.";
const NOT_ACTIVE = "Programa não encontrado. Abra Hoje de novo.";

function revalidateDeload() {
  revalidatePath("/app/today");
  revalidatePath("/app/programs");
  revalidatePath("/app/progress");
}

export async function applyDeload(enrollmentId: string, weekKey: string): Promise<ActionResult> {
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return { ok: false, error: SESSION_EXPIRED_ERROR };
  if (typeof enrollmentId !== "string" || !ID.test(enrollmentId)) return { ok: false, error: NOT_ACTIVE };
  const now = new Date();
  if (weekKey !== thisWeekKey(now)) return { ok: false, error: STALE_WEEK };
  const monday = Number(weekKey);

  // The signal as it stands now (the card may be hours old): the program's rule must still call for it.
  const plan = await getUpcomingPlan(user.id, now, null);
  if (!plan.hasPlan || plan.enrollment.id !== enrollmentId) return { ok: false, error: NOT_ACTIVE };
  if (!plan.appliedDeload) {
    const signal = await getFatigueSignal(user.id, plan.enrollment, {
      now,
      weekView: plan.weekView,
      guidance: plan.guidance,
      lastWeekDeload: plan.habit.streak.lastWeek?.deload === true,
      entryWeekTrained: plan.habit.program?.entryWeekTrained ?? false,
    });
    if (signal?.level !== "deload") {
      return { ok: false, error: "O sinal de fadiga mudou desde que esta tela abriu. Veja Hoje de novo." };
    }
  }

  const outcome = await prisma.$transaction(async (tx) => {
    // The lock a workout start takes: an apply lands wholly before or after a start.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`;
    const enrollment = await tx.programEnrollment.findFirst({
      where: { id: enrollmentId, userId: user.id, status: "ACTIVE" },
      select: { deloadMondays: true },
    });
    if (!enrollment) return "NOT_ACTIVE" as const;
    if (enrollment.deloadMondays.includes(monday)) return "OK" as const;
    if (inDeloadCooldown(enrollment.deloadMondays, monday)) return "COOLDOWN" as const;
    await tx.programEnrollment.update({
      where: { id: enrollmentId },
      data: { deloadMondays: [...enrollment.deloadMondays, monday].sort((a, b) => a - b) },
    });
    return "OK" as const;
  });
  if (outcome === "NOT_ACTIVE") return { ok: false, error: NOT_ACTIVE };
  if (outcome === "COOLDOWN") return { ok: false, error: "Você aplicou um deload há menos de 4 semanas." };
  revalidateDeload();
  return { ok: true };
}

export async function undoDeload(enrollmentId: string, weekKey: string): Promise<ActionResult> {
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return { ok: false, error: SESSION_EXPIRED_ERROR };
  if (typeof enrollmentId !== "string" || !ID.test(enrollmentId)) return { ok: false, error: NOT_ACTIVE };
  const now = new Date();
  if (weekKey !== thisWeekKey(now)) return { ok: false, error: STALE_WEEK };
  const monday = Number(weekKey);

  const outcome = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`;
    const enrollment = await tx.programEnrollment.findFirst({
      where: { id: enrollmentId, userId: user.id, status: "ACTIVE" },
      select: { deloadMondays: true },
    });
    if (!enrollment) return "NOT_ACTIVE" as const;
    if (!enrollment.deloadMondays.includes(monday)) return "OK" as const;
    // A workout started under it keeps the week a deload (its sets were halved).
    const started = await tx.workoutSession.count({
      where: {
        userId: user.id,
        enrollmentId,
        isDeload: true,
        status: { in: ["IN_PROGRESS", "COMPLETED"] },
        startedAt: { gte: startOfWeek(now) },
      },
    });
    if (started > 0) return "STARTED" as const;
    await tx.programEnrollment.update({
      where: { id: enrollmentId },
      data: { deloadMondays: enrollment.deloadMondays.filter((m) => m !== monday) },
    });
    return "OK" as const;
  });
  if (outcome === "NOT_ACTIVE") return { ok: false, error: NOT_ACTIVE };
  if (outcome === "STARTED") {
    return { ok: false, error: "Um treino desta semana já começou com metade das séries: o deload fica." };
  }
  revalidateDeload();
  return { ok: true };
}

/**
 * "Agora não" / "Entendi": this week's signal stays closed (on every device).
 * Only this week's, and only for one of the user's own programs: nothing
 * else ever becomes a dismissal row.
 */
export async function dismissFatigueSignal(enrollmentId: string, weekKey: string): Promise<ActionResult> {
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return { ok: false, error: SESSION_EXPIRED_ERROR };
  if (typeof enrollmentId !== "string" || !ID.test(enrollmentId)) return { ok: false, error: NOT_ACTIVE };
  if (weekKey !== thisWeekKey(new Date())) return { ok: false, error: STALE_WEEK };
  const own = await prisma.programEnrollment.count({ where: { id: enrollmentId, userId: user.id } });
  if (own === 0) return { ok: false, error: NOT_ACTIVE };
  await prisma.userDismissal.createMany({
    data: [{ userId: user.id, key: fatigueDismissalKey(enrollmentId, weekKey) }],
    skipDuplicates: true,
  });
  revalidatePath("/app/today");
  return { ok: true };
}
