"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { requireUserOrThrow } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { sessionVolumeKg, workingSetCount, totalReps } from "@/lib/training/volume";
import { checkAndRecordPersonalRecords } from "@/lib/training/personal-records";
import { startOfWeek } from "@/lib/training/week";
import { resolveSessionDay } from "@/lib/training/day-match";

type Tx = Prisma.TransactionClient;

/** A set "has data" once it is completed or holds a typed load/reps. */
const SET_HAS_DATA: Prisma.SetLogWhereInput = {
  OR: [{ isCompleted: true }, { weightKg: { not: null } }, { reps: { not: null } }],
};

/**
 * Opens the workout for a program day — idempotently. A user has at most one
 * workout in progress: starting a day that is already in progress resumes it,
 * and starting another day while a session with logged data is open sends the
 * user back to that session (with a notice) instead of silently creating a
 * second one. Open sessions with nothing logged are abandoned starts and are
 * discarded. Before this, a second empty copy of a day could take over Today's
 * "Treino em andamento" and look like the finished workout had been lost.
 */
async function openSessionForDay(
  userId: string,
  dayId: string,
  enrollmentId?: string,
): Promise<{ sessionId: string; blocked: boolean }> {
  const day = await prisma.userProgramDay.findUniqueOrThrow({
    where: { id: dayId },
    include: { exercises: { orderBy: { sortOrder: "asc" } }, program: true },
  });
  if (day.program.userId !== userId) throw new Error("FORBIDDEN");

  const enrollment = enrollmentId
    ? await prisma.programEnrollment.findUniqueOrThrow({ where: { id: enrollmentId } })
    : await prisma.programEnrollment.findFirst({
        where: { userId, programId: day.programId, status: "ACTIVE" },
      });
  if (enrollment && enrollment.userId !== userId) throw new Error("FORBIDDEN");

  return prisma.$transaction(async (tx) => {
    // Serialize starts per user so two taps or two tabs can't both create a session.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

    const openRows = await tx.workoutSession.findMany({
      where: { userId, status: "IN_PROGRESS" },
      orderBy: { startedAt: "desc" },
      select: { id: true, name: true, programId: true, programDayId: true, programDayIndex: true },
    });
    const withData = new Set(
      openRows.length === 0
        ? []
        : (
            await tx.setLog.findMany({
              where: { sessionId: { in: openRows.map((s) => s.id) }, ...SET_HAS_DATA },
              select: { sessionId: true },
              distinct: ["sessionId"],
            })
          ).map((s) => s.sessionId),
    );
    // Same day: by id, or (when a program edit recreated the days) by name/position.
    const programDays = openRows.some((s) => s.programDayId === null && s.programId === day.programId)
      ? await tx.userProgramDay.findMany({ where: { programId: day.programId }, select: { id: true, dayIndex: true, name: true } })
      : [];
    const isSameDay = (s: (typeof openRows)[number]) =>
      s.programDayId === day.id ||
      (s.programDayId === null && s.programId === day.programId && resolveSessionDay(s, programDays)?.id === day.id);
    const sameDay =
      openRows.find((s) => isSameDay(s) && withData.has(s.id)) ?? openRows.find((s) => isSameDay(s));
    if (sameDay) return { sessionId: sameDay.id, blocked: false };
    const busy = openRows.find((s) => withData.has(s.id));
    if (busy) return { sessionId: busy.id, blocked: true };
    if (openRows.length > 0) {
      await tx.workoutSession.updateMany({
        where: { id: { in: openRows.map((s) => s.id) }, status: "IN_PROGRESS" },
        data: { status: "DISCARDED" },
      });
    }

    const session = await tx.workoutSession.create({
      data: {
        userId,
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
            userId,
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

    // Pre-create one row per prescribed set (warm-up + working) so the set
    // table can show every box the program asks for.
    const rows = session.exerciseLogs.flatMap((log) => {
      const warmups = Math.min(Math.max(0, log.warmupSets), 20);
      const working = Math.min(Math.max(0, log.prescribedSets), 40);
      return [
        ...Array.from({ length: warmups }, (_, i) => ({
          userId,
          sessionId: session.id,
          exerciseLogId: log.id,
          exerciseId: log.exerciseId,
          setNumber: i + 1,
          setType: "WARMUP" as const,
        })),
        ...Array.from({ length: working }, (_, i) => ({
          userId,
          sessionId: session.id,
          exerciseLogId: log.id,
          exerciseId: log.exerciseId,
          setNumber: warmups + i + 1,
          setType: "WORKING" as const,
        })),
      ];
    });
    if (rows.length) await tx.setLog.createMany({ data: rows });

    return { sessionId: session.id, blocked: false };
  });
}

function workoutUrl({ sessionId, blocked }: { sessionId: string; blocked: boolean }) {
  return `/app/workout/${sessionId}${blocked ? "?aviso=em-andamento" : ""}`;
}

/** Starts (or resumes) a session from a scheduled program day. */
export async function startWorkoutSessionFromProgramDay(enrollmentId: string, dayId: string) {
  const user = await requireUserOrThrow();
  const opened = await openSessionForDay(user.id, dayId, enrollmentId);
  revalidatePath("/app/today");
  redirect(workoutUrl(opened));
}

/** Starts (or resumes) a session from a UserProgramDay. If the user has an
 * ACTIVE enrollment in this program, the session is linked to it so finishing
 * advances the program's day/week progression; otherwise it runs as a
 * standalone ad-hoc day. */
export async function startAdHocWorkoutSession(dayId: string) {
  const user = await requireUserOrThrow();
  const opened = await openSessionForDay(user.id, dayId);
  revalidatePath("/app/today");
  redirect(workoutUrl(opened));
}

export interface LogSetInput {
  setLogId: string;
  weightKg: number | null;
  reps: number | null;
  rir: number | null;
  notes?: string;
}

/** CLOSED: the session is no longer in progress (finished elsewhere) or the set is gone. */
export type SetActionResult = { ok: true } | { ok: false; reason: "CLOSED" | "INVALID" };

/** Clamp a client-supplied number into a finite range, or null for nullish/NaN/Infinity. */
function clampNum(v: number | null | undefined, min: number, max: number): number | null {
  if (v === null || v === undefined || typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.min(max, Math.max(min, v));
}

function cleanValues(input: { weightKg: number | null; reps: number | null; rir: number | null }) {
  const reps = clampNum(input.reps, 0, 1000);
  return {
    weightKg: clampNum(input.weightKg, 0, 2000),
    reps: reps === null ? null : Math.round(reps),
    rir: clampNum(input.rir, 0, 20),
  };
}

/** A row counts as a set only with a load and at least one rep. */
function isFilled(v: { weightKg: number | null; reps: number | null }) {
  return v.weightKg !== null && v.reps !== null && v.reps >= 1;
}

/**
 * Locks (shared) the session a set belongs to and returns what we need if it
 * is the user's and still in progress. finishWorkoutSession locks the same row
 * FOR UPDATE, so a set write and a finish can never interleave: the write
 * either lands before the totals are computed or sees the session closed.
 */
async function lockOpenSet(tx: Tx, userId: string, setLogId: string) {
  const rows = await tx.$queryRaw<{ sessionId: string; isExtra: boolean }[]>`
    SELECT l."sessionId", l."isExtra"
    FROM "SetLog" l JOIN "WorkoutSession" s ON s.id = l."sessionId"
    WHERE l.id = ${setLogId} AND l."userId" = ${userId} AND s.status = 'IN_PROGRESS'
    FOR SHARE OF s`;
  return rows[0] ?? null;
}

async function lockOpenExerciseLog(tx: Tx, userId: string, exerciseLogId: string) {
  const rows = await tx.$queryRaw<{ sessionId: string; exerciseId: string }[]>`
    SELECT e."sessionId", e."exerciseId"
    FROM "WorkoutExerciseLog" e JOIN "WorkoutSession" s ON s.id = e."sessionId"
    WHERE e.id = ${exerciseLogId} AND e."userId" = ${userId} AND s.status = 'IN_PROGRESS'
    FOR SHARE OF s`;
  return rows[0] ?? null;
}

/** Marks a set done with its load/reps (✓ in the set table). */
export async function logSet(input: LogSetInput): Promise<SetActionResult> {
  const user = await requireUserOrThrow();
  if (typeof input?.setLogId !== "string") return { ok: false, reason: "INVALID" };
  const values = cleanValues(input);
  if (!isFilled(values)) return { ok: false, reason: "INVALID" };

  const sessionId = await prisma.$transaction(async (tx) => {
    const open = await lockOpenSet(tx, user.id, input.setLogId);
    if (!open) return null;
    await tx.setLog.update({
      where: { id: input.setLogId },
      data: {
        ...values,
        notes: typeof input.notes === "string" ? input.notes.slice(0, 2000) : undefined,
        isCompleted: true,
        completedAt: new Date(),
      },
    });
    return open.sessionId;
  });
  if (!sessionId) return { ok: false, reason: "CLOSED" };
  revalidatePath(`/app/workout/${sessionId}`);
  return { ok: true };
}

/**
 * Autosaves what the user typed in a row without marking it done, so values
 * survive switching exercises, reloads and the phone killing the tab. A done
 * row that loses its load or reps (cleared, or unparseable) stops counting.
 */
export async function saveSetValues(input: LogSetInput): Promise<SetActionResult> {
  const user = await requireUserOrThrow();
  if (typeof input?.setLogId !== "string") return { ok: false, reason: "INVALID" };
  const values = cleanValues(input);
  const result = await prisma.$transaction(async (tx) => {
    const open = await lockOpenSet(tx, user.id, input.setLogId);
    if (!open) return null;
    const before = await tx.setLog.findUniqueOrThrow({ where: { id: input.setLogId }, select: { isCompleted: true } });
    const undo = before.isCompleted && !isFilled(values);
    await tx.setLog.update({
      where: { id: input.setLogId },
      data: undo ? { ...values, isCompleted: false, completedAt: null } : values,
    });
    return { sessionId: open.sessionId, undo };
  });
  if (!result) return { ok: false, reason: "CLOSED" };
  if (result.undo) revalidatePath(`/app/workout/${result.sessionId}`);
  return { ok: true };
}

export async function uncompleteSet(setLogId: string): Promise<SetActionResult> {
  const user = await requireUserOrThrow();
  if (typeof setLogId !== "string") return { ok: false, reason: "INVALID" };
  const sessionId = await prisma.$transaction(async (tx) => {
    const open = await lockOpenSet(tx, user.id, setLogId);
    if (!open) return null;
    await tx.setLog.update({ where: { id: setLogId }, data: { isCompleted: false, completedAt: null } });
    return open.sessionId;
  });
  if (!sessionId) return { ok: false, reason: "CLOSED" };
  revalidatePath(`/app/workout/${sessionId}`);
  return { ok: true };
}

/** Adds a set beyond the prescription, flagged as extra so it never passes for a prescribed one. */
export async function addExtraSet(exerciseLogId: string): Promise<SetActionResult> {
  const user = await requireUserOrThrow();
  if (typeof exerciseLogId !== "string") return { ok: false, reason: "INVALID" };
  const result = await prisma.$transaction(async (tx) => {
    const open = await lockOpenExerciseLog(tx, user.id, exerciseLogId);
    if (!open) return "CLOSED" as const;
    const sets = await tx.setLog.findMany({ where: { exerciseLogId }, select: { setNumber: true } });
    if (sets.length >= 60) return "INVALID" as const;
    await tx.setLog.create({
      data: {
        userId: user.id,
        sessionId: open.sessionId,
        exerciseLogId,
        exerciseId: open.exerciseId,
        setNumber: Math.max(0, ...sets.map((s) => s.setNumber)) + 1,
        setType: "WORKING",
        isExtra: true,
      },
    });
    return open.sessionId;
  });
  if (result === "CLOSED" || result === "INVALID") return { ok: false, reason: result };
  revalidatePath(`/app/workout/${result}`);
  return { ok: true };
}

/** Removes an extra set. Prescribed rows can't be deleted — leaving them empty is how you skip one. */
export async function removeSet(setLogId: string): Promise<SetActionResult> {
  const user = await requireUserOrThrow();
  if (typeof setLogId !== "string") return { ok: false, reason: "INVALID" };
  const result = await prisma.$transaction(async (tx) => {
    const open = await lockOpenSet(tx, user.id, setLogId);
    if (!open) return "CLOSED" as const;
    if (!open.isExtra) return "INVALID" as const;
    await tx.setLog.delete({ where: { id: setLogId } });
    return open.sessionId;
  });
  if (result === "CLOSED" || result === "INVALID") return { ok: false, reason: result };
  revalidatePath(`/app/workout/${result}`);
  return { ok: true };
}

/** Skips (or un-skips) an exercise. Sets already ✓'d before skipping still count; the rest don't. */
export async function skipExercise(exerciseLogId: string, skipped = true): Promise<SetActionResult> {
  const user = await requireUserOrThrow();
  if (typeof exerciseLogId !== "string") return { ok: false, reason: "INVALID" };
  const sessionId = await prisma.$transaction(async (tx) => {
    const open = await lockOpenExerciseLog(tx, user.id, exerciseLogId);
    if (!open) return null;
    await tx.workoutExerciseLog.update({ where: { id: exerciseLogId }, data: { wasSkipped: skipped === true } });
    return open.sessionId;
  });
  if (!sessionId) return { ok: false, reason: "CLOSED" };
  revalidatePath(`/app/workout/${sessionId}`);
  return { ok: true };
}

export async function setWorkoutNote(sessionId: string, notes: string) {
  const user = await requireUserOrThrow();
  const session = await prisma.workoutSession.findUniqueOrThrow({ where: { id: sessionId } });
  if (session.userId !== user.id) throw new Error("FORBIDDEN");
  await prisma.workoutSession.update({ where: { id: sessionId }, data: { notes } });
}

export type FinishResult =
  | { ok: true; summaryUrl: string }
  | { ok: false; reason: "EMPTY" | "NOT_FOUND" };

/**
 * Finishes the session. A row with load and reps is a set the user did: rows
 * typed but never confirmed with ✓ — sent in `pending` from this device, or
 * autosaved earlier from any device — are saved and counted instead of
 * silently dropped (skipped exercises keep only what was ✓'d). A session with
 * no working set recorded is not finished (EMPTY): that used to count as a
 * completed program day and wipe "Último treino". Idempotent: finishing an
 * already finished session just returns its summary.
 */
export async function finishWorkoutSession(sessionId: string, pending: LogSetInput[] = []): Promise<FinishResult> {
  const user = await requireUserOrThrow();
  if (typeof sessionId !== "string") return { ok: false, reason: "NOT_FOUND" };
  const summaryUrl = `/app/workout/${sessionId}/summary`;
  const drafts = (Array.isArray(pending) ? pending : []).slice(0, 400);
  const now = new Date();

  const outcome = await prisma.$transaction(async (tx) => {
    // Lock the session row: concurrent set writes (FOR SHARE) and a second
    // finish from another tab wait here and then see it closed.
    const [row] = await tx.$queryRaw<{ status: string }[]>`
      SELECT status::text AS status FROM "WorkoutSession"
      WHERE id = ${sessionId} AND "userId" = ${user.id}
      FOR UPDATE`;
    if (!row) return "GONE" as const;
    if (row.status === "COMPLETED") return "ALREADY" as const;
    if (row.status !== "IN_PROGRESS") return "GONE" as const;

    const openRows = { sessionId, userId: user.id, exerciseLog: { wasSkipped: false } };
    for (const d of drafts) {
      if (!d || typeof d.setLogId !== "string") continue;
      const values = cleanValues(d);
      // In a skipped exercise only rows already ✓'d can still be edited.
      const where = {
        sessionId,
        userId: user.id,
        id: d.setLogId,
        OR: [{ exerciseLog: { wasSkipped: false } }, { isCompleted: true }],
      };
      await tx.setLog.updateMany({ where, data: values });
      if (!isFilled(values)) {
        await tx.setLog.updateMany({ where: { ...where, isCompleted: true }, data: { isCompleted: false, completedAt: null } });
      }
    }
    // Every filled row of a non-skipped exercise counts, whether or not ✓ was
    // tapped and wherever it was typed (another device, a lost local mirror).
    await tx.setLog.updateMany({
      where: { ...openRows, isCompleted: false, weightKg: { not: null }, reps: { gte: 1 } },
      data: { isCompleted: true, completedAt: now },
    });

    const session = await tx.workoutSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: { setLogs: true, enrollment: true },
    });
    if (workingSetCount(session.setLogs) === 0) return "EMPTY" as const;

    await tx.workoutSession.update({
      where: { id: sessionId },
      data: {
        status: "COMPLETED",
        finishedAt: now,
        durationSeconds: Math.max(0, Math.round((now.getTime() - session.startedAt.getTime()) / 1000)),
        totalVolumeKg: sessionVolumeKg(session.setLogs),
        totalWorkingSets: workingSetCount(session.setLogs),
        totalReps: totalReps(session.setLogs),
      },
    });

    if (session.enrollment && session.enrollment.status === "ACTIVE" && session.programId) {
      await advanceProgram(tx, {
        userId: user.id,
        sessionId,
        enrollment: session.enrollment,
        programId: session.programId,
        session,
        now,
      });
    }
    return "FLIPPED" as const;
  });

  if (outcome === "GONE") return { ok: false, reason: "NOT_FOUND" };
  if (outcome === "EMPTY") return { ok: false, reason: "EMPTY" };
  if (outcome === "FLIPPED") {
    try {
      await checkAndRecordPersonalRecords(user.id, sessionId);
    } catch (err) {
      // The workout is saved; a PR bookkeeping failure must not look like a failed finish.
      console.error("PR recording failed", sessionId, err);
    }
  }

  revalidatePath("/app/today");
  revalidatePath("/app/history");
  return { ok: true, summaryUrl };
}

/**
 * Moves the program forward after a finished day.
 * - The program week counts the calendar weeks (São Paulo) the user trained
 *   in: the first finished workout of a new calendar week starts the next
 *   program week. Redos, skipped or out-of-order days and weeks off never make
 *   the counter jump or stall.
 * - The suggested next day rotates for programs that repeat days within a
 *   week (A/B at 3×); otherwise it is the next day not yet done this week,
 *   back to the first day once all of them are.
 */
async function advanceProgram(
  tx: Tx,
  s: {
    userId: string;
    sessionId: string;
    enrollment: { id: string; currentWeek: number; nextDayIndex: number };
    programId: string;
    session: { programDayId: string | null; programDayIndex: number | null; name: string };
    now: Date;
  },
) {
  const program = await tx.userProgram.findUnique({
    where: { id: s.programId },
    include: { days: { orderBy: { dayIndex: "asc" } } },
  });
  if (!program || program.days.length === 0) return;
  const days = program.days;

  // userId keeps these on the (userId, …) indexes.
  const finished = {
    userId: s.userId,
    enrollmentId: s.enrollment.id,
    status: "COMPLETED" as const,
    totalWorkingSets: { gt: 0 },
    id: { not: s.sessionId },
  };
  const thisWeek = await tx.workoutSession.findMany({
    where: { ...finished, finishedAt: { gte: startOfWeek(s.now) } },
    select: { programDayId: true, programDayIndex: true, name: true },
  });
  let week = s.enrollment.currentWeek;
  if (thisWeek.length === 0 && (await tx.workoutSession.findFirst({ where: finished, select: { id: true } }))) {
    week += 1;
  }

  const thisDay = resolveSessionDay(s.session, days);
  let nextDayIndex = s.enrollment.nextDayIndex;
  if (thisDay) {
    const pos = days.indexOf(thisDay);
    const order = days.map((_, i) => days[(pos + 1 + i) % days.length]);
    if (program.daysPerWeek > days.length) {
      nextDayIndex = order[0].dayIndex;
    } else {
      const doneIds = new Set(thisWeek.map((x) => resolveSessionDay(x, days)?.id));
      doneIds.add(thisDay.id);
      nextDayIndex = (order.find((d) => !doneIds.has(d.id)) ?? days[0]).dayIndex;
    }
  }

  await tx.workoutSession.update({ where: { id: s.sessionId }, data: { programWeek: week } });
  await tx.programEnrollment.update({
    where: { id: s.enrollment.id },
    data: { completedSessions: { increment: 1 }, nextDayIndex, currentWeek: week },
  });
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

/**
 * Abandons an in-progress session (kept as DISCARDED; it never counts).
 * `onlyIfEmpty` is for a screen that believes nothing was recorded: if sets
 * were saved meanwhile (another device), refuse instead of throwing them away.
 */
export async function discardWorkoutSession(
  sessionId: string,
  opts?: { onlyIfEmpty?: boolean },
): Promise<{ ok: boolean; reason?: "HAS_SETS" }> {
  const user = await requireUserOrThrow();
  if (typeof sessionId !== "string") return { ok: false };
  const res = await prisma.workoutSession.updateMany({
    where: {
      id: sessionId,
      userId: user.id,
      status: "IN_PROGRESS",
      ...(opts?.onlyIfEmpty === true
        ? { setLogs: { none: { OR: [{ isCompleted: true }, { weightKg: { not: null }, reps: { gte: 1 } }] } } }
        : {}),
    },
    data: { status: "DISCARDED" },
  });
  revalidatePath("/app/today");
  if (res.count > 0) return { ok: true };
  if (opts?.onlyIfEmpty === true) {
    const open = await prisma.workoutSession.count({ where: { id: sessionId, userId: user.id, status: "IN_PROGRESS" } });
    if (open > 0) return { ok: false, reason: "HAS_SETS" };
  }
  return { ok: false };
}
