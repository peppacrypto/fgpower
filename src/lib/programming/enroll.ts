import "server-only";

import { prisma } from "@/lib/db";
import { isUniqueViolation } from "@/lib/db/prisma-error";
import { getTemplateBySlug } from "@/lib/data/templates";
import { adaptRowKey } from "@/lib/data/alternatives";
import { applyWeekLayout } from "@/lib/data/program-lifecycle";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Forking a template into a user-owned program and making a program the user's
 * only active one. These were born inside `lib/actions/programs` and are shared
 * from here so the onboarding auto-enroll (`lib/programming/auto-enroll`) can
 * reuse the exact same fork + activation as "Ativar e começar" — without
 * turning these internal, userId-taking helpers into client-callable server
 * actions. Behaviour is unchanged from when they lived in programs.ts.
 */

type Tx = Prisma.TransactionClient;

/** A set "has data" once it is completed or holds a typed load/reps (as in workouts.ts). */
export const SET_HAS_DATA: Prisma.SetLogWhereInput = {
  OR: [{ isCompleted: true }, { weightKg: { not: null } }, { reps: { not: null } }],
};

/** Swaps + name applied to a fork ("Adaptar", and the onboarding auto-adapt). */
export type ForkAdapt = {
  swaps: Map<string, { exerciseId: string; replaces: string; repMin: number; repMax: number; noteSuffix: string }>;
  name: string;
};

/**
 * Fork a canonical WorkoutTemplate into a user-owned UserProgram. Forking
 * NEVER mutates the template — every user gets their own independent copy
 * (spec §9: "Customize creates a user-owned fork rather than modifying the
 * canonical template").
 */
export async function forkTemplateToProgram(templateSlug: string, userId: string, adapt?: ForkAdapt) {
  const template = await getTemplateBySlug(templateSlug);
  if (!template) throw new Error("TEMPLATE_NOT_FOUND");

  const program = await prisma.userProgram.create({
    data: {
      userId,
      name: adapt?.name ?? template.namePt,
      description: template.taglinePt,
      sourceTemplateId: template.id,
      sourceTemplateVersion: template.version,
      goal: template.goal,
      daysPerWeek: template.daysPerWeek,
      durationWeeks: template.durationWeeks,
      progressionStrategy: template.progressionStrategy,
      weeklyGuidance: template.weeklyGuidance as never,
      status: "DRAFT",
      days: {
        create: template.days.map((day) => ({
          dayIndex: day.dayIndex,
          name: day.namePt,
          focus: day.focusPt,
          estimatedMinutes: day.estimatedMinutes,
          exercises: {
            create: day.exercises.map((ex) => {
              // "Adaptar para halteres": the swapped-in exercise keeps the row's
              // prescription; its cue was written for the original, so it says so.
              const swap = adapt?.swaps.get(adaptRowKey(day.dayIndex, ex));
              return {
                exerciseId: swap?.exerciseId ?? ex.exerciseId,
                sortOrder: ex.sortOrder,
                groupKey: ex.groupKey,
                sets: ex.sets,
                repMin: swap?.repMin ?? ex.repMin,
                repMax: swap?.repMax ?? ex.repMax,
                rirTarget: ex.rirTarget,
                rpeTarget: ex.rpeTarget,
                restSeconds: ex.restSeconds,
                tempo: ex.tempo,
                warmupSets: ex.warmupSets,
                progressionStrategy: ex.progressionStrategy,
                loadIncrementKg: ex.loadIncrementKg,
                notes: swap ? `No lugar de ${swap.replaces}.${swap.noteSuffix}${ex.notesPt ? ` ${ex.notesPt}` : ""}` : ex.notesPt,
              };
            }),
          },
        })),
      },
    },
  });

  return program;
}

export async function setAsOnlyActiveProgram(tx: Tx, userId: string, programId: string) {
  // Only one enrollment is ACTIVE at a time — starting a new program ends
  // (does not delete) any other in-progress one, preserving its history.
  // Runs on the caller's transaction so the abandon-then-create is atomic
  // under the per-user advisory lock (one ACTIVE enrollment per user).
  await tx.programEnrollment.updateMany({
    where: { userId, status: "ACTIVE" },
    data: { status: "ABANDONED", endedAt: new Date() },
  });
  await tx.userProgram.updateMany({
    where: { userId, status: "ACTIVE", id: { not: programId } },
    data: { status: "ARCHIVED", archivedAt: new Date() },
  });
  // Open workouts with nothing logged are abandoned starts: don't let one
  // hold Today's "Treino em andamento" slot for the new program. Sessions
  // with logged sets stay open so the user can finish or discard them.
  await tx.workoutSession.updateMany({
    where: { userId, status: "IN_PROGRESS", setLogs: { none: SET_HAS_DATA } },
    data: { status: "DISCARDED" },
  });
}

/**
 * Makes the program the user's only active one with a fresh enrollment.
 * Returns the enrollment it ended, if any (for the switch undo). Refuses a
 * program without a single exercise — it would put a plan with nothing to
 * train on Today and open blank workouts.
 */
export async function startProgramInternal(
  userId: string,
  programId: string,
): Promise<{ ok: true; previousEnrollmentId: string | null } | { ok: false; reason: "EMPTY" | "ALREADY_ACTIVE" }> {
  const program = await prisma.userProgram.findUniqueOrThrow({
    where: { id: programId },
    include: { days: { include: { exercises: true }, orderBy: { dayIndex: "asc" } } },
  });
  if (program.userId !== userId) throw new Error("FORBIDDEN");
  if (!program.days.some((d) => d.exercises.length > 0)) return { ok: false, reason: "EMPTY" };

  try {
    return await prisma.$transaction(async (tx) => {
      // Serialize activation per user (same lock key as openSessionForDay and
      // restorePreviousProgram) so two taps / two tabs can't both create an
      // ACTIVE enrollment. `previous` is re-read under the lock.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

      const previous = await tx.programEnrollment.findFirst({
        where: { userId, status: "ACTIVE" },
        orderBy: { startedAt: "desc" },
        select: { id: true, programId: true },
      });
      // Starting the program that is already running would reset it to week 1.
      if (previous?.programId === programId) return { ok: false, reason: "ALREADY_ACTIVE" } as const;

      await setAsOnlyActiveProgram(tx, userId, programId);

      // A finished or archived program started again leaves "Arquivados".
      await tx.userProgram.update({ where: { id: programId }, data: { status: "ACTIVE", archivedAt: null } });

      await tx.programEnrollment.create({
        data: {
          userId,
          programId,
          status: "ACTIVE",
          currentWeek: 1,
          nextDayIndex: program.days[0]?.dayIndex ?? 0,
          plannedSessions: program.durationWeeks ? program.durationWeeks * program.daysPerWeek : null,
          programSnapshot: program as never,
        },
      });
      // Its days onto the user's week (Today's schedule) and its frequency onto the profile.
      await applyWeekLayout(tx, userId, programId);
      return { ok: true, previousEnrollmentId: previous?.id ?? null } as const;
    });
  } catch (err) {
    // The partial unique index (ProgramEnrollment_userId_active_key) is the
    // real guard: a racing activation that slipped past the re-read hits it.
    // ProgramEnrollment has no other unique constraint, so P2002 here can only
    // be that index — treat it as "already running", never a 500.
    if (isUniqueViolation(err)) return { ok: false, reason: "ALREADY_ACTIVE" };
    throw err;
  }
}
