"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { getTemplateBySlug } from "@/lib/data/templates";
import { findUndoableSwitch } from "@/lib/data/dashboard";
import { applyWeekLayout, getProgramRestart } from "@/lib/data/program-lifecycle";
import { startAdHocWorkoutSession } from "@/lib/actions/workouts";
import { seriesPosition } from "@/lib/training/program-calendar";
import type { Prisma } from "@/generated/prisma/client";

/** A set "has data" once it is completed or holds a typed load/reps (as in workouts.ts). */
const SET_HAS_DATA: Prisma.SetLogWhereInput = {
  OR: [{ isCompleted: true }, { weightKg: { not: null } }, { reps: { not: null } }],
};

/**
 * Fork a canonical WorkoutTemplate into a user-owned UserProgram. Forking
 * NEVER mutates the template — every user gets their own independent copy
 * (spec §9: "Customize creates a user-owned fork rather than modifying the
 * canonical template").
 */
async function forkTemplateToProgram(templateSlug: string, userId: string) {
  const template = await getTemplateBySlug(templateSlug);
  if (!template) throw new Error("TEMPLATE_NOT_FOUND");

  const program = await prisma.userProgram.create({
    data: {
      userId,
      name: template.namePt,
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
            create: day.exercises.map((ex) => ({
              exerciseId: ex.exerciseId,
              sortOrder: ex.sortOrder,
              groupKey: ex.groupKey,
              sets: ex.sets,
              repMin: ex.repMin,
              repMax: ex.repMax,
              rirTarget: ex.rirTarget,
              rpeTarget: ex.rpeTarget,
              restSeconds: ex.restSeconds,
              tempo: ex.tempo,
              warmupSets: ex.warmupSets,
              progressionStrategy: ex.progressionStrategy,
              loadIncrementKg: ex.loadIncrementKg,
              notes: ex.notesPt,
            })),
          },
        })),
      },
    },
  });

  return program;
}

async function setAsOnlyActiveProgram(userId: string, programId: string) {
  // Only one enrollment is ACTIVE at a time — starting a new program ends
  // (does not delete) any other in-progress one, preserving its history.
  await prisma.programEnrollment.updateMany({
    where: { userId, status: "ACTIVE" },
    data: { status: "ABANDONED", endedAt: new Date() },
  });
  await prisma.userProgram.updateMany({
    where: { userId, status: "ACTIVE", id: { not: programId } },
    data: { status: "ARCHIVED", archivedAt: new Date() },
  });
  // Open workouts with nothing logged are abandoned starts: don't let one
  // hold Today's "Treino em andamento" slot for the new program. Sessions
  // with logged sets stay open so the user can finish or discard them.
  await prisma.workoutSession.updateMany({
    where: { userId, status: "IN_PROGRESS", setLogs: { none: SET_HAS_DATA } },
    data: { status: "DISCARDED" },
  });
}

/**
 * Today after activating a program. A switch carries the enrollment it ended
 * (`anterior`) so Today can offer a one-time "Voltar para …" undo.
 */
function activatedUrl(previousEnrollmentId: string | null) {
  return previousEnrollmentId ? `/app/today?ativado=1&anterior=${previousEnrollmentId}` : "/app/today?ativado=1";
}

export async function startTemplate(templateSlug: string) {
  const user = await requireUserOrThrow();
  const program = await forkTemplateToProgram(templateSlug, user.id);
  const started = await startProgramInternal(user.id, program.id);
  redirect(started.ok ? activatedUrl(started.previousEnrollmentId) : "/app/today");
}

/**
 * "Ativar e começar": activates the template (same rules as startTemplate)
 * and opens its first day's workout right away — the one-tap path from a
 * recommendation to the first set. The workout opens exactly as Today's
 * "Iniciar treino" would open it (startAdHocWorkoutSession: linked to the new
 * enrollment, resumes/blocks like any start). If this tap also ended another
 * program (a stale page), it lands on Today instead, where the switch can be
 * undone.
 */
export async function startTemplateAndBegin(templateSlug: string) {
  const user = await requireUserOrThrow();
  const program = await forkTemplateToProgram(templateSlug, user.id);
  const started = await startProgramInternal(user.id, program.id);
  if (!started.ok) redirect("/app/today");
  if (started.previousEnrollmentId) redirect(activatedUrl(started.previousEnrollmentId));
  // The day Today would suggest first on a fresh enrollment: the first one with exercises.
  const firstDay = await prisma.userProgramDay.findFirst({
    where: { programId: program.id, exercises: { some: {} } },
    orderBy: { dayIndex: "asc" },
    select: { id: true },
  });
  if (!firstDay) redirect(activatedUrl(null));
  // Redirects into the workout.
  await startAdHocWorkoutSession(firstDay.id);
}

export async function customizeTemplate(templateSlug: string) {
  const user = await requireUserOrThrow();
  const program = await forkTemplateToProgram(templateSlug, user.id);
  redirect(`/app/programs/${program.id}/edit`);
}

/**
 * Makes the program the user's only active one with a fresh enrollment.
 * Returns the enrollment it ended, if any (for the switch undo). Refuses a
 * program without a single exercise — it would put a plan with nothing to
 * train on Today and open blank workouts.
 */
async function startProgramInternal(
  userId: string,
  programId: string,
): Promise<{ ok: true; previousEnrollmentId: string | null } | { ok: false; reason: "EMPTY" | "ALREADY_ACTIVE" }> {
  const program = await prisma.userProgram.findUniqueOrThrow({
    where: { id: programId },
    include: { days: { include: { exercises: true }, orderBy: { dayIndex: "asc" } } },
  });
  if (program.userId !== userId) throw new Error("FORBIDDEN");
  if (!program.days.some((d) => d.exercises.length > 0)) return { ok: false, reason: "EMPTY" };

  const previous = await prisma.programEnrollment.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { startedAt: "desc" },
    select: { id: true, programId: true },
  });
  // Starting the program that is already running would reset it to week 1.
  if (previous?.programId === programId) return { ok: false, reason: "ALREADY_ACTIVE" };

  await setAsOnlyActiveProgram(userId, programId);

  // A finished or archived program started again leaves "Arquivados".
  await prisma.userProgram.update({ where: { id: programId }, data: { status: "ACTIVE", archivedAt: null } });

  await prisma.programEnrollment.create({
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
  await applyWeekLayout(prisma, userId, programId);
  return { ok: true, previousEnrollmentId: previous?.id ?? null };
}

export async function startProgram(programId: string) {
  const user = await requireUserOrThrow();
  const started = await startProgramInternal(user.id, programId);
  if (!started.ok) {
    // The program page explains why (no exercises yet / already running).
    redirect(started.reason === "ALREADY_ACTIVE" ? "/app/today" : `/app/programs/${programId}`);
  }
  redirect(activatedUrl(started.previousEnrollmentId));
}

/** Timestamps written by one request (fork → activate) land well within this. */
const SAME_REQUEST_MS = 10_000;

/**
 * Undoes a program switch: the enrollment the switch ended becomes active
 * again exactly where it was (week, next day, completed sessions), within
 * 24 h. The program switched to is ended the way a switch ends one — except a
 * template copy made by that very tap and never trained or edited, which is
 * removed so an accidental "Trocar" leaves no trace (a never-trained program
 * of the user's own goes back to the shelf as a draft). Only the switch that
 * ended this enrollment can be undone (see findUndoableSwitch).
 */
export async function restorePreviousProgram(enrollmentId: string) {
  const user = await requireUserOrThrow();
  if (typeof enrollmentId !== "string") redirect("/app/today");
  const now = new Date();

  const restored = await prisma.$transaction(async (tx) => {
    // Same per-user lock as starting a workout: no start or double tap interleaves.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`;
    const found = await findUndoableSwitch(tx, user.id, enrollmentId, now);
    if (!found) return null;
    const { previous, active } = found;

    await tx.programEnrollment.updateMany({
      where: { id: { in: active.map((e) => e.id) } },
      data: { status: "ABANDONED", endedAt: now },
    });
    // As in a switch: a day of the program being left that was opened but
    // never logged is an abandoned start — it must not stay on Today as
    // "Treino em andamento" for a program that is no longer running.
    await tx.workoutSession.updateMany({
      where: {
        userId: user.id,
        status: "IN_PROGRESS",
        programId: { in: active.map((e) => e.programId) },
        setLogs: { none: SET_HAS_DATA },
      },
      data: { status: "DISCARDED" },
    });
    for (const enrollment of active) {
      const program = await tx.userProgram.findUnique({
        where: { id: enrollment.programId },
        select: {
          sourceTemplateId: true,
          createdAt: true,
          updatedAt: true,
          // Discarded starts (just above, or earlier) don't make it a trained program.
          _count: { select: { sessions: { where: { status: { not: "DISCARDED" } } } } },
        },
      });
      if (!program) continue;
      const started = enrollment.startedAt.getTime();
      const untouched = program._count.sessions === 0;
      // Forked by "Ativar" in the same request as the switch, and never edited since.
      const throwaway =
        untouched &&
        program.sourceTemplateId !== null &&
        started - program.createdAt.getTime() < SAME_REQUEST_MS &&
        program.updatedAt.getTime() - started < SAME_REQUEST_MS;
      if (throwaway) {
        await tx.userProgram.deleteMany({ where: { id: enrollment.programId, userId: user.id } });
      } else {
        // Never trained: back on the shelf as a draft; trained: archived like any switch.
        await tx.userProgram.updateMany({
          where: { id: enrollment.programId, userId: user.id },
          data: untouched ? { status: "DRAFT", archivedAt: null } : { status: "ARCHIVED", archivedAt: now },
        });
      }
    }
    await tx.userProgram.updateMany({
      where: { userId: user.id, status: "ACTIVE", id: { not: previous.programId } },
      data: { status: "ARCHIVED", archivedAt: now },
    });
    await tx.userProgram.update({
      where: { id: previous.programId },
      data: { status: "ACTIVE", archivedAt: null },
    });
    await tx.programEnrollment.update({
      where: { id: previous.id },
      data: { status: "ACTIVE", endedAt: null },
    });
    return previous.programId;
  });
  // The profile's weekly frequency goes back with the program (the switch had set the other one's).
  if (restored) await applyWeekLayout(prisma, user.id, restored);

  revalidatePath("/app/today");
  revalidatePath("/app/programs");
  redirect(restored ? "/app/today?retomado=1" : "/app/today");
}

export async function createCustomProgram(name: string) {
  const user = await requireUserOrThrow();
  // Trained as often as the user said they train: a one-day full body is 3×/week, not 1×.
  const profile = await prisma.profile.findUnique({ where: { userId: user.id }, select: { daysPerWeek: true } });
  const program = await prisma.userProgram.create({
    data: {
      userId: user.id,
      name: name || "Meu programa",
      status: "DRAFT",
      daysPerWeek: Math.max(1, Math.min(7, profile?.daysPerWeek ?? 3)),
    },
  });
  redirect(`/app/programs/${program.id}/edit`);
}

export async function duplicateProgram(programId: string) {
  const user = await requireUserOrThrow();
  const original = await prisma.userProgram.findUniqueOrThrow({
    where: { id: programId },
    include: { days: { include: { exercises: true }, orderBy: { dayIndex: "asc" } } },
  });
  if (original.userId !== user.id) throw new Error("FORBIDDEN");

  await prisma.userProgram.create({
    data: {
      userId: user.id,
      name: `${original.name} (cópia)`,
      description: original.description,
      goal: original.goal,
      daysPerWeek: original.daysPerWeek,
      durationWeeks: original.durationWeeks,
      progressionStrategy: original.progressionStrategy,
      weeklyGuidance: original.weeklyGuidance as never,
      status: "DRAFT",
      days: {
        create: original.days.map((day) => ({
          dayIndex: day.dayIndex,
          name: day.name,
          focus: day.focus,
          estimatedMinutes: day.estimatedMinutes,
          exercises: {
            create: day.exercises.map((ex) => ({
              exerciseId: ex.exerciseId,
              sortOrder: ex.sortOrder,
              groupKey: ex.groupKey,
              sets: ex.sets,
              repMin: ex.repMin,
              repMax: ex.repMax,
              rirTarget: ex.rirTarget,
              rpeTarget: ex.rpeTarget,
              restSeconds: ex.restSeconds,
              tempo: ex.tempo,
              warmupSets: ex.warmupSets,
              progressionStrategy: ex.progressionStrategy,
              loadIncrementKg: ex.loadIncrementKg,
              notes: ex.notes,
            })),
          },
        })),
      },
    },
  });
  revalidatePath("/app/programs");
}

/**
 * Moves a program to "Arquivados". Archiving the active one ends its
 * enrollment where it stands — the program page asks first — and it can be
 * restored and picked up again from that week (resumeProgram). A day of it
 * opened but never logged goes too, as in a switch.
 */
export async function archiveProgram(programId: string) {
  const user = await requireUserOrThrow();
  const program = await prisma.userProgram.findUniqueOrThrow({ where: { id: programId } });
  if (program.userId !== user.id) throw new Error("FORBIDDEN");
  const now = new Date();

  await prisma.userProgram.update({
    where: { id: programId },
    data: { status: "ARCHIVED", archivedAt: now },
  });
  await prisma.programEnrollment.updateMany({
    where: { programId, status: "ACTIVE" },
    data: { status: "ABANDONED", endedAt: now },
  });
  await prisma.workoutSession.updateMany({
    where: { userId: user.id, programId, status: "IN_PROGRESS", setLogs: { none: SET_HAS_DATA } },
    data: { status: "DISCARDED" },
  });
  revalidatePath("/app/programs");
  revalidatePath("/app/today");
}

/** "Restaurar": an archived program back on the shelf, as a draft — started again from its page. */
export async function restoreArchivedProgram(programId: string) {
  const user = await requireUserOrThrow();
  if (typeof programId !== "string") redirect("/app/programs");
  await prisma.userProgram.updateMany({
    where: { id: programId, userId: user.id, status: "ARCHIVED" },
    data: { status: "DRAFT", archivedAt: null },
  });
  revalidatePath("/app/programs");
  redirect(`/app/programs/${programId}`);
}

/**
 * "Excluir": removes a program that was never trained — a draft, or one
 * archived before any workout (discarded starts don't count). A program
 * with workouts can only be archived: its history stays.
 */
export async function deleteUntrainedProgram(programId: string) {
  const user = await requireUserOrThrow();
  if (typeof programId !== "string") redirect("/app/programs");
  const program = await prisma.userProgram.findFirst({
    where: { id: programId, userId: user.id },
    select: { status: true, _count: { select: { sessions: { where: { status: { not: "DISCARDED" } } } } } },
  });
  if (!program) redirect("/app/programs");
  if (program.status === "ACTIVE" || program._count.sessions > 0) redirect(`/app/programs/${programId}`);
  await prisma.userProgram.deleteMany({ where: { id: programId, userId: user.id } });
  revalidatePath("/app/programs");
  redirect("/app/programs?excluido=1");
}

/**
 * "Retomar da semana N": makes a stopped program the active one again with
 * the enrollment it had — its week, next day and workouts — instead of a new
 * one at week 1 (see getProgramRestart for the week it picks up at; a block
 * stopped in its last week resumes at that week, its counter one step back).
 * A program running meanwhile is ended as by a switch, with the same one-time
 * "Voltar para …" undo on Today, which opens with "<programa> retomado · semana N".
 */
export async function resumeProgram(programId: string) {
  const user = await requireUserOrThrow();
  if (typeof programId !== "string") redirect("/app/programs");
  const program = await prisma.userProgram.findFirst({
    where: { id: programId, userId: user.id },
    select: { id: true, days: { select: { _count: { select: { exercises: true } } } } },
  });
  if (!program) redirect("/app/programs");
  const [restart, previous] = await Promise.all([
    getProgramRestart(user.id, programId),
    prisma.programEnrollment.findFirst({
      where: { userId: user.id, status: "ACTIVE" },
      orderBy: { startedAt: "desc" },
      select: { id: true, programId: true },
    }),
  ]);
  if (previous?.programId === programId) redirect("/app/today");
  if (!restart.resumable || !program.days.some((d) => d._count.exercises > 0)) redirect(`/app/programs/${programId}`);

  await setAsOnlyActiveProgram(user.id, programId);
  await prisma.userProgram.update({ where: { id: programId }, data: { status: "ACTIVE", archivedAt: null } });
  await prisma.programEnrollment.update({
    where: { id: restart.resumable.enrollmentId },
    data: { status: "ACTIVE", endedAt: null, currentWeek: restart.resumable.currentWeek },
  });
  await applyWeekLayout(prisma, user.id, programId);
  revalidatePath("/app/programs");
  revalidatePath("/app/today");
  // Today says "<programa> retomado · semana N" (not "Programa ativado"), with the switch's undo when one ended.
  redirect(previous ? `/app/today?retomado=1&anterior=${previous.id}` : "/app/today?retomado=1");
}

/**
 * The finished block these act on: the one given (the user's own, COMPLETED)
 * or the latest one. Null once something was started after it — a second tap
 * or a stale page must not start another copy.
 */
async function completedBlockToFollow(userId: string, enrollmentId: unknown) {
  const block = await prisma.programEnrollment.findFirst({
    where: { userId, status: "COMPLETED", ...(typeof enrollmentId === "string" ? { id: enrollmentId } : {}) },
    orderBy: { endedAt: "desc" },
    select: {
      id: true,
      endedAt: true,
      programId: true,
      program: { select: { sourceTemplate: { select: { slug: true } } } },
    },
  });
  if (!block?.endedAt) return null;
  const startedSince = await prisma.programEnrollment.findFirst({
    where: { userId, status: "ACTIVE", startedAt: { gt: block.endedAt } },
    select: { id: true },
  });
  return startedSince ? null : block;
}

/**
 * "Começar <GD N>": activates the next block of the GD series after the one
 * just finished (a fresh copy of its template), and lands on Today. Usable
 * as a plain form action; binding a CompletedBlock's enrollmentId pins it.
 */
export async function startNextBlock(enrollmentId?: unknown) {
  const user = await requireUserOrThrow();
  const block = await completedBlockToFollow(user.id, enrollmentId);
  if (!block) redirect("/app/today");
  const nextSlug = seriesPosition(block.program.sourceTemplate?.slug)?.nextSlug;
  if (!nextSlug) redirect("/app/programs");
  const program = await forkTemplateToProgram(nextSlug, user.id);
  const started = await startProgramInternal(user.id, program.id);
  revalidatePath("/app/programs");
  redirect(started.ok ? activatedUrl(started.previousEnrollmentId) : "/app/today");
}

/**
 * "Começar <GD N>" on the finished block's own page. The page's switch
 * confirm has already asked about any program running now, so this switches
 * on purpose — no "started since" guard, only that the block is the user's
 * and finished — and Today offers the one-time "Voltar para …" undo.
 */
export async function switchToNextBlock(enrollmentId: string) {
  const user = await requireUserOrThrow();
  if (typeof enrollmentId !== "string") redirect("/app/programs");
  const block = await prisma.programEnrollment.findFirst({
    where: { id: enrollmentId, userId: user.id, status: "COMPLETED" },
    select: { programId: true, endedAt: true, program: { select: { sourceTemplate: { select: { slug: true } } } } },
  });
  if (!block) redirect("/app/programs");
  const nextSlug = seriesPosition(block.program.sourceTemplate?.slug)?.nextSlug;
  if (!nextSlug) redirect(`/app/programs/${block.programId}`);
  // Already started from here (a double tap, a stale page): don't fork a second copy.
  const running = await prisma.programEnrollment.findFirst({
    where: {
      userId: user.id,
      status: "ACTIVE",
      startedAt: { gt: block.endedAt ?? new Date(0) },
      program: { sourceTemplate: { slug: nextSlug } },
    },
    select: { id: true },
  });
  if (running) redirect("/app/today");
  const program = await forkTemplateToProgram(nextSlug, user.id);
  const started = await startProgramInternal(user.id, program.id);
  revalidatePath("/app/programs");
  redirect(started.ok ? activatedUrl(started.previousEnrollmentId) : "/app/today");
}

/**
 * "Repetir bloco": the finished program again from week 1 — the user's own
 * copy, with any changes they made to it. Same arguments as startNextBlock.
 */
export async function repeatBlock(enrollmentId?: unknown) {
  const user = await requireUserOrThrow();
  const block = await completedBlockToFollow(user.id, enrollmentId);
  if (!block) redirect("/app/today");
  const started = await startProgramInternal(user.id, block.programId);
  if (!started.ok) redirect(started.reason === "ALREADY_ACTIVE" ? "/app/today" : `/app/programs/${block.programId}`);
  revalidatePath("/app/programs");
  redirect(activatedUrl(started.previousEnrollmentId));
}
