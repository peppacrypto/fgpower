"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { sessionVolumeKg, workingSetCount, totalReps } from "@/lib/training/volume";
import { checkAndRecordPersonalRecords } from "@/lib/training/personal-records";

/** Starts a session from a scheduled program day. Pre-creates empty set slots for every prescribed set. */
export async function startWorkoutSessionFromProgramDay(enrollmentId: string, dayId: string) {
  const user = await requireUserOrThrow();

  const enrollment = await prisma.programEnrollment.findUniqueOrThrow({ where: { id: enrollmentId } });
  if (enrollment.userId !== user.id) throw new Error("FORBIDDEN");

  const day = await prisma.userProgramDay.findUniqueOrThrow({
    where: { id: dayId },
    include: { exercises: { orderBy: { sortOrder: "asc" } }, program: true },
  });
  if (day.program.userId !== user.id) throw new Error("FORBIDDEN");

  const session = await prisma.workoutSession.create({
    data: {
      userId: user.id,
      enrollmentId,
      programId: day.programId,
      programDayId: day.id,
      name: day.name,
      status: "IN_PROGRESS",
      programWeek: enrollment.currentWeek,
      programDayIndex: day.dayIndex,
      daySnapshot: day as never,
      exerciseLogs: {
        create: day.exercises.map((ex) => ({
          userId: user.id,
          exerciseId: ex.exerciseId,
          programExerciseId: ex.id,
          sortOrder: ex.sortOrder,
          groupKey: ex.groupKey,
          prescribedSets: ex.sets,
          repMin: ex.repMin,
          repMax: ex.repMax,
          rirTarget: ex.rirTarget,
          rpeTarget: ex.rpeTarget,
          restSeconds: ex.restSeconds,
          warmupSets: ex.warmupSets,
          tempo: ex.tempo,
          notes: ex.notes,
        })),
      },
    },
    include: { exerciseLogs: true },
  });

  // Pre-create empty set slots (warm-up + working) for each exercise log.
  for (const log of session.exerciseLogs) {
    const rows = [
      ...Array.from({ length: Math.min(Math.max(0, log.warmupSets), 20) }, (_, i) => ({
        userId: user.id,
        sessionId: session.id,
        exerciseLogId: log.id,
        exerciseId: log.exerciseId,
        setNumber: i + 1,
        setType: "WARMUP" as const,
      })),
      ...Array.from({ length: Math.min(Math.max(0, log.prescribedSets), 40) }, (_, i) => ({
        userId: user.id,
        sessionId: session.id,
        exerciseLogId: log.id,
        exerciseId: log.exerciseId,
        setNumber: log.warmupSets + i + 1,
        setType: "WORKING" as const,
      })),
    ];
    if (rows.length) await prisma.setLog.createMany({ data: rows });
  }

  redirect(`/app/workout/${session.id}`);
}

/** Starts a session from a UserProgramDay. If the user has an ACTIVE enrollment
 * in this program, the session is linked to it so finishing advances the
 * program's day/week progression; otherwise it runs as a standalone ad-hoc day. */
export async function startAdHocWorkoutSession(dayId: string) {
  const user = await requireUserOrThrow();
  const day = await prisma.userProgramDay.findUniqueOrThrow({
    where: { id: dayId },
    include: { exercises: { orderBy: { sortOrder: "asc" } }, program: true },
  });
  if (day.program.userId !== user.id) throw new Error("FORBIDDEN");

  const enrollment = await prisma.programEnrollment.findFirst({
    where: { userId: user.id, programId: day.programId, status: "ACTIVE" },
  });

  const session = await prisma.workoutSession.create({
    data: {
      userId: user.id,
      enrollmentId: enrollment?.id,
      programId: day.programId,
      programDayId: day.id,
      name: day.name,
      status: "IN_PROGRESS",
      programWeek: enrollment?.currentWeek,
      programDayIndex: day.dayIndex,
      daySnapshot: day as never,
      exerciseLogs: {
        create: day.exercises.map((ex) => ({
          userId: user.id,
          exerciseId: ex.exerciseId,
          programExerciseId: ex.id,
          sortOrder: ex.sortOrder,
          groupKey: ex.groupKey,
          prescribedSets: ex.sets,
          repMin: ex.repMin,
          repMax: ex.repMax,
          rirTarget: ex.rirTarget,
          rpeTarget: ex.rpeTarget,
          restSeconds: ex.restSeconds,
          warmupSets: ex.warmupSets,
          tempo: ex.tempo,
          notes: ex.notes,
        })),
      },
    },
    include: { exerciseLogs: true },
  });

  for (const log of session.exerciseLogs) {
    const rows = [
      ...Array.from({ length: Math.min(Math.max(0, log.warmupSets), 20) }, (_, i) => ({
        userId: user.id,
        sessionId: session.id,
        exerciseLogId: log.id,
        exerciseId: log.exerciseId,
        setNumber: i + 1,
        setType: "WARMUP" as const,
      })),
      ...Array.from({ length: Math.min(Math.max(0, log.prescribedSets), 40) }, (_, i) => ({
        userId: user.id,
        sessionId: session.id,
        exerciseLogId: log.id,
        exerciseId: log.exerciseId,
        setNumber: log.warmupSets + i + 1,
        setType: "WORKING" as const,
      })),
    ];
    if (rows.length) await prisma.setLog.createMany({ data: rows });
  }

  redirect(`/app/workout/${session.id}`);
}

export interface LogSetInput {
  setLogId: string;
  weightKg: number | null;
  reps: number | null;
  rir: number | null;
  notes?: string;
}

/** Clamp a client-supplied number into a finite range, or null for nullish/NaN/Infinity. */
function clampNum(v: number | null | undefined, min: number, max: number): number | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  return Math.min(max, Math.max(min, v));
}

export async function logSet(input: LogSetInput) {
  const user = await requireUserOrThrow();
  const set = await prisma.setLog.findUniqueOrThrow({ where: { id: input.setLogId } });
  if (set.userId !== user.id) throw new Error("FORBIDDEN");

  const reps = clampNum(input.reps, 0, 1000);
  await prisma.setLog.update({
    where: { id: input.setLogId },
    data: {
      weightKg: clampNum(input.weightKg, 0, 2000),
      reps: reps === null ? null : Math.round(reps),
      rir: clampNum(input.rir, 0, 20),
      notes: typeof input.notes === "string" ? input.notes.slice(0, 2000) : input.notes,
      isCompleted: true,
      completedAt: new Date(),
    },
  });
  revalidatePath(`/app/workout/${set.sessionId}`);
}

export async function uncompleteSet(setLogId: string) {
  const user = await requireUserOrThrow();
  const set = await prisma.setLog.findUniqueOrThrow({ where: { id: setLogId } });
  if (set.userId !== user.id) throw new Error("FORBIDDEN");
  await prisma.setLog.update({ where: { id: setLogId }, data: { isCompleted: false, completedAt: null } });
  revalidatePath(`/app/workout/${set.sessionId}`);
}

export async function addSet(exerciseLogId: string) {
  const user = await requireUserOrThrow();
  const log = await prisma.workoutExerciseLog.findUniqueOrThrow({
    where: { id: exerciseLogId },
    include: { sets: true },
  });
  if (log.userId !== user.id) throw new Error("FORBIDDEN");

  const nextSetNumber = Math.max(0, ...log.sets.map((s) => s.setNumber)) + 1;
  await prisma.setLog.create({
    data: {
      userId: user.id,
      sessionId: log.sessionId,
      exerciseLogId,
      exerciseId: log.exerciseId,
      setNumber: nextSetNumber,
      setType: "WORKING",
    },
  });
  revalidatePath(`/app/workout/${log.sessionId}`);
}

export async function removeSet(setLogId: string) {
  const user = await requireUserOrThrow();
  const set = await prisma.setLog.findUniqueOrThrow({ where: { id: setLogId } });
  if (set.userId !== user.id) throw new Error("FORBIDDEN");
  await prisma.setLog.delete({ where: { id: setLogId } });
  revalidatePath(`/app/workout/${set.sessionId}`);
}

export async function skipExercise(exerciseLogId: string) {
  const user = await requireUserOrThrow();
  const log = await prisma.workoutExerciseLog.findUniqueOrThrow({ where: { id: exerciseLogId } });
  if (log.userId !== user.id) throw new Error("FORBIDDEN");
  await prisma.workoutExerciseLog.update({ where: { id: exerciseLogId }, data: { wasSkipped: true } });
  revalidatePath(`/app/workout/${log.sessionId}`);
}

export async function setWorkoutNote(sessionId: string, notes: string) {
  const user = await requireUserOrThrow();
  const session = await prisma.workoutSession.findUniqueOrThrow({ where: { id: sessionId } });
  if (session.userId !== user.id) throw new Error("FORBIDDEN");
  await prisma.workoutSession.update({ where: { id: sessionId }, data: { notes } });
}

export async function finishWorkoutSession(sessionId: string) {
  const user = await requireUserOrThrow();
  const session = await prisma.workoutSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { setLogs: true, enrollment: true },
  });
  if (session.userId !== user.id) throw new Error("FORBIDDEN");

  const now = new Date();
  const durationSeconds = Math.max(0, Math.round((now.getTime() - session.startedAt.getTime()) / 1000));

  // Atomic, idempotent transition: only the call that actually flips
  // IN_PROGRESS → COMPLETED runs the one-time side effects (progression + PRs).
  // A double-submit (or a re-finish of an already-completed session) is a no-op.
  const transition = await prisma.workoutSession.updateMany({
    where: { id: sessionId, status: "IN_PROGRESS" },
    data: {
      status: "COMPLETED",
      finishedAt: now,
      durationSeconds,
      totalVolumeKg: sessionVolumeKg(session.setLogs),
      totalWorkingSets: workingSetCount(session.setLogs),
      totalReps: totalReps(session.setLogs),
    },
  });

  if (transition.count > 0) {
    if (session.enrollment) {
      const program = await prisma.userProgram.findUnique({
        where: { id: session.programId ?? undefined },
        include: { days: { orderBy: { dayIndex: "asc" } } },
      });
      if (program && program.days.length > 0) {
        // Resolve the current position by the session's snapshot dayIndex (stable
        // across program edits) and fall back to the live day id only if absent.
        const curIdx =
          session.programDayIndex ?? program.days.findIndex((d) => d.id === session.programDayId);
        const wrappedToStart = curIdx < 0 || curIdx >= program.days.length - 1;
        const nextIdx = wrappedToStart ? program.days[0].dayIndex : program.days[curIdx + 1].dayIndex;
        await prisma.programEnrollment.update({
          where: { id: session.enrollment.id },
          data: {
            completedSessions: { increment: 1 },
            nextDayIndex: nextIdx,
            currentWeek: wrappedToStart ? session.enrollment.currentWeek + 1 : session.enrollment.currentWeek,
          },
        });
      }
    }
    await checkAndRecordPersonalRecords(user.id, sessionId);
  }

  revalidatePath("/app/today");
  redirect(`/app/workout/${sessionId}/summary`);
}

/** Permanently deletes a completed session and all its logs (spec §43.15). */
export async function deleteWorkoutSession(sessionId: string) {
  const user = await requireUserOrThrow();
  const session = await prisma.workoutSession.findUniqueOrThrow({ where: { id: sessionId } });
  if (session.userId !== user.id) throw new Error("FORBIDDEN");
  await prisma.workoutSession.delete({ where: { id: sessionId } });
  revalidatePath("/app/history");
  redirect("/app/history");
}

export async function discardWorkoutSession(sessionId: string) {
  const user = await requireUserOrThrow();
  const session = await prisma.workoutSession.findUniqueOrThrow({ where: { id: sessionId } });
  if (session.userId !== user.id) throw new Error("FORBIDDEN");
  await prisma.workoutSession.update({ where: { id: sessionId }, data: { status: "DISCARDED" } });
  redirect("/app/today");
}
