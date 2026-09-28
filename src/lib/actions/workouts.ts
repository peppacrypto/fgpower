"use server";

import { RedirectType, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { requireUserOrThrow } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { sessionVolumeKg, workingSetCount, totalReps } from "@/lib/training/volume";
import { checkAndRecordPersonalRecords } from "@/lib/training/personal-records";
import { startOfWeek } from "@/lib/training/week";
import { MAX_BOUT_SECONDS, assessOpenSession, boutSeconds, setBouts, staleSaveTiming } from "@/lib/training/stale";
import { resolveSessionDay } from "@/lib/training/day-match";
import { planWeek, restartsEachWeek } from "@/lib/training/day-rotation";
import { blockEnds, countedWeeks } from "@/lib/programming/block-progress";
import { closeBlock, entryWeekWasTrained, recordWorkoutMilestone } from "@/lib/data/program-lifecycle";
import { isStillEditable } from "@/lib/data/workout-session";
import { buildWorkoutActivitySummary } from "@/lib/social/activity-summary";
import { afterFinish, afterRescore } from "@/lib/workouts/finish-hooks";

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

  const [enrollment, defaults] = await Promise.all([
    enrollmentId
      ? prisma.programEnrollment.findUniqueOrThrow({ where: { id: enrollmentId } })
      : prisma.programEnrollment.findFirst({
          where: { userId, programId: day.programId, status: "ACTIVE" },
        }),
    // The workout carries the profile's sharing defaults from the start (decision
    // 10): finishing it publishes it that way (finish-hooks → publishOnFinish).
    prisma.profile.findUnique({ where: { userId }, select: { defaultWorkoutVisibility: true, showLoadsPublicly: true } }),
  ]);
  if (enrollment && enrollment.userId !== userId) throw new Error("FORBIDDEN");

  return prisma.$transaction(async (tx) => {
    // Serialize starts per user so two taps or two tabs can't both create a session.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

    const openRows = await tx.workoutSession.findMany({
      where: { userId, status: "IN_PROGRESS" },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        name: true,
        startedAt: true,
        programId: true,
        programDayId: true,
        programDayIndex: true,
        _count: { select: { exerciseLogs: true } },
      },
    });
    const dataRows =
      openRows.length === 0
        ? []
        : await tx.setLog.findMany({
            where: { sessionId: { in: openRows.map((s) => s.id) }, ...SET_HAS_DATA },
            select: {
              sessionId: true,
              isCompleted: true,
              completedAt: true,
              updatedAt: true,
              weightKg: true,
              reps: true,
              exerciseLog: { select: { wasSkipped: true } },
            },
          });
    const withData = new Set(dataRows.map((r) => r.sessionId));
    // A workout left open on an earlier day (Today lists it as "não finalizado",
    // same rule) neither blocks nor gets discarded: it waits to be saved on its
    // own day or discarded explicitly. Only live sessions take part below.
    const now = new Date();
    const leftOpen = new Set(
      openRows
        .filter(
          (s) =>
            withData.has(s.id) &&
            assessOpenSession(
              s.startedAt,
              dataRows.filter((r) => r.sessionId === s.id).map((r) => ({ ...r, wasSkipped: r.exerciseLog.wasSkipped })),
              now,
            ).leftOpen,
        )
        .map((s) => s.id),
    );
    const liveRows = openRows.filter((s) => !leftOpen.has(s.id));
    // Same day: by id, or (when a program edit recreated the days) by name/position.
    const programDays = openRows.some((s) => s.programDayId === null && s.programId === day.programId)
      ? await tx.userProgramDay.findMany({ where: { programId: day.programId }, select: { id: true, dayIndex: true, name: true } })
      : [];
    const isSameDay = (s: (typeof openRows)[number]) =>
      s.programDayId === day.id ||
      (s.programDayId === null && s.programId === day.programId && resolveSessionDay(s, programDays)?.id === day.id);
    const sameDay =
      liveRows.find((s) => isSameDay(s) && withData.has(s.id)) ?? liveRows.find((s) => isSameDay(s));
    // A day opened while it had no exercises is a dead end: once exercises
    // were added to it (the empty workout links to the editor), start afresh.
    const emptyShell = sameDay && sameDay._count.exerciseLogs === 0 && day.exercises.length > 0;
    if (sameDay && !emptyShell) return { sessionId: sameDay.id, blocked: false };
    const busy = liveRows.find((s) => withData.has(s.id));
    if (busy) return { sessionId: busy.id, blocked: true };
    if (liveRows.length > 0) {
      await tx.workoutSession.updateMany({
        where: { id: { in: liveRows.map((s) => s.id) }, status: "IN_PROGRESS" },
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
        visibility: defaults?.defaultWorkoutVisibility ?? "PRIVATE",
        showDetailedLoads: defaults?.showLoadsPublicly ?? false,
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
  /** When ✓ was tapped (client clock, ms): a ✓ replayed after a lost connection keeps its own time. */
  completedAtMs?: number | null;
}

/** CLOSED: the session is no longer in progress (finished elsewhere) or the set is gone. */
export type SetActionResult = { ok: true } | { ok: false; reason: "CLOSED" | "INVALID" };

/**
 * A swap or an added exercise (W-006): the exercise log to show next. HAS_DATA:
 * the exercise being swapped already has sets — add the pick after it instead.
 */
export type ExerciseChangeResult =
  | { ok: true; exerciseLogId: string }
  | { ok: false; reason: "CLOSED" | "INVALID" | "HAS_DATA" | "DUPLICATE" };

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
 * Locks (shared) the session a set belongs to and returns what we need if the
 * set is the user's (null when it doesn't exist — e.g. an extra removed on
 * another device). `inProgress` is false once the session was finished or
 * discarded. finishWorkoutSession locks the same row FOR UPDATE, so a set
 * write and a finish can never interleave: the write either lands before the
 * totals are computed or sees the session closed.
 */
async function lockSet(tx: Tx, userId: string, setLogId: string) {
  const rows = await tx.$queryRaw<
    { sessionId: string; isExtra: boolean; isCompleted: boolean; startedAt: Date; inProgress: boolean }[]
  >`
    SELECT l."sessionId", l."isExtra", l."isCompleted", s."startedAt", s.status = 'IN_PROGRESS' AS "inProgress"
    FROM "SetLog" l JOIN "WorkoutSession" s ON s.id = l."sessionId"
    WHERE l.id = ${setLogId} AND l."userId" = ${userId}
    FOR SHARE OF s`;
  return rows[0] ?? null;
}

/** lockSet, for a session still in progress only. */
async function lockOpenSet(tx: Tx, userId: string, setLogId: string) {
  const row = await lockSet(tx, userId, setLogId);
  return row?.inProgress ? row : null;
}

/**
 * Locks the session of one of the user's exercise logs while it is in
 * progress (null otherwise), like lockSet. `exclusive` (FOR UPDATE) is for
 * changing the exercise itself: it waits for the set writes in flight (FOR
 * SHARE) and holds new ones back, so "has data" and "already in the workout"
 * are judged on what is committed. The exercise is read after the lock: a
 * swap that committed while this waited has changed it.
 */
async function lockOpenExerciseLog(tx: Tx, userId: string, exerciseLogId: string, exclusive = false) {
  const rows = exclusive
    ? await tx.$queryRaw<{ sessionId: string }[]>`
        SELECT e."sessionId"
        FROM "WorkoutExerciseLog" e JOIN "WorkoutSession" s ON s.id = e."sessionId"
        WHERE e.id = ${exerciseLogId} AND e."userId" = ${userId} AND s.status = 'IN_PROGRESS'
        FOR UPDATE OF s`
    : await tx.$queryRaw<{ sessionId: string }[]>`
        SELECT e."sessionId"
        FROM "WorkoutExerciseLog" e JOIN "WorkoutSession" s ON s.id = e."sessionId"
        WHERE e.id = ${exerciseLogId} AND e."userId" = ${userId} AND s.status = 'IN_PROGRESS'
        FOR SHARE OF s`;
  if (!rows[0]) return null;
  const log = await tx.workoutExerciseLog.findUniqueOrThrow({ where: { id: exerciseLogId }, select: { exerciseId: true } });
  return { sessionId: rows[0].sessionId, exerciseId: log.exerciseId };
}

/**
 * One write to a set row, the single rule behind ✓, un-✓ and autosave.
 * `done`: true = ✓ (needs load and reps), false = un-✓, null = values only
 * (a ✓'d row that loses its load or reps stops counting). Idempotent — the
 * workout screen resends it until it gets through: a set already ✓'d keeps
 * its original completion time. CLOSED: the session is no longer in
 * progress; GONE: the row itself no longer exists (an extra removed).
 */
async function writeSet(
  userId: string,
  input: LogSetInput,
  done: boolean | null,
): Promise<{ ok: true; isCompleted: boolean } | { ok: false; reason: "CLOSED" | "INVALID" | "GONE" }> {
  if (typeof input?.setLogId !== "string") return { ok: false, reason: "INVALID" };
  const values = cleanValues(input);
  if (done === true && !isFilled(values)) return { ok: false, reason: "INVALID" };
  const notes = typeof input.notes === "string" ? input.notes.slice(0, 2000) : undefined;

  const result = await prisma.$transaction(async (tx) => {
    const open = await lockSet(tx, userId, input.setLogId);
    if (!open) return "GONE" as const;
    if (!open.inProgress) return "CLOSED" as const;
    const now = Date.now();
    let completion: { isCompleted: boolean; completedAt?: Date | null } | null = null;
    if (done === true && !open.isCompleted) {
      // The tap time, kept within the session (a phone clock can be off).
      const tapped = clampNum(input.completedAtMs, open.startedAt.getTime(), now) ?? now;
      completion = { isCompleted: true, completedAt: new Date(tapped) };
    } else if ((done === false || (done === null && !isFilled(values))) && open.isCompleted) {
      completion = { isCompleted: false, completedAt: null };
    }
    await tx.setLog.update({ where: { id: input.setLogId }, data: { ...values, notes, ...completion } });
    return { isCompleted: completion ? completion.isCompleted : open.isCompleted };
  });
  if (result === "GONE" || result === "CLOSED") return { ok: false, reason: result };
  return { ok: true, isCompleted: result.isCompleted };
}

/** The set actions' result: a row that is gone reads as closed, as before GONE existed. */
function asActionResult(r: Awaited<ReturnType<typeof writeSet>>): SetActionResult {
  if (r.ok) return { ok: true };
  return { ok: false, reason: r.reason === "GONE" ? "CLOSED" : r.reason };
}

// The set writes below don't revalidate the workout page: the workout screen
// owns their state (optimistic, mirrored locally, resent until confirmed), and
// a full page re-render on every ✓ made each tap wait on ~19 KB of RSC.

/** Marks a set done with its load/reps (✓ in the set table). */
export async function logSet(input: LogSetInput): Promise<SetActionResult> {
  const user = await requireUserOrThrow();
  return asActionResult(await writeSet(user.id, input, true));
}

/**
 * Autosaves what the user typed in a row without marking it done, so values
 * survive switching exercises, reloads and the phone killing the tab. A done
 * row that loses its load or reps (cleared, or unparseable) stops counting.
 */
export async function saveSetValues(input: LogSetInput): Promise<SetActionResult> {
  const user = await requireUserOrThrow();
  return asActionResult(await writeSet(user.id, input, null));
}

export async function uncompleteSet(setLogId: string): Promise<SetActionResult> {
  const user = await requireUserOrThrow();
  if (typeof setLogId !== "string") return { ok: false, reason: "INVALID" };
  const result = await prisma.$transaction(async (tx) => {
    const open = await lockOpenSet(tx, user.id, setLogId);
    if (!open) return null;
    await tx.setLog.update({ where: { id: setLogId }, data: { isCompleted: false, completedAt: null } });
    return open.sessionId;
  });
  if (!result) return { ok: false, reason: "CLOSED" };
  return { ok: true };
}

/** A row's state as the workout screen wants it on the server (see writeSet for `done`). */
export interface SetSyncOp extends LogSetInput {
  done: boolean | null;
}
/** CLOSED: the session is no longer in progress; GONE: the row no longer exists (an extra removed elsewhere). */
export type SetSyncResult =
  | { setLogId: string; ok: true; isCompleted: boolean }
  | { setLogId: string; ok: false; reason: "CLOSED" | "INVALID" | "GONE" };

/**
 * Applies a batch of row writes from the workout screen's outbox (called by
 * POST /api/workout/sets). Each row is its own short transaction, so one
 * closed or invalid row never blocks the rest. `savedAtMs` is taken after the
 * last commit: a page rendered later already shows these writes.
 */
export async function syncSets(ops: SetSyncOp[]): Promise<{ results: SetSyncResult[]; savedAtMs: number }> {
  const user = await requireUserOrThrow();
  const results: SetSyncResult[] = [];
  for (const op of (Array.isArray(ops) ? ops : []).slice(0, 200)) {
    const setLogId = typeof op?.setLogId === "string" ? op.setLogId : "";
    const done = op?.done === true || op?.done === false ? op.done : null;
    const r = await writeSet(user.id, op, done);
    results.push({ setLogId, ...r });
  }
  return { results, savedAtMs: Date.now() };
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

/**
 * "Trocar" mid-workout (W-006: the machine is taken, the gym has no such
 * equipment): the exercise log now holds `newExerciseId`, with its untouched
 * set rows — same ids, same prescription — so history, records, "Último
 * treino" and the progression all read the exercise actually performed.
 * `substitutedFromExerciseId` keeps the program's exercise (swapping back to it
 * clears it). The program's note for its exercise ("Cada série = braço D +
 * E", "segure 30 s" — which also makes the column seconds) doesn't carry over
 * to a stand-in; swapping back brings it back. Only while none of its sets
 * holds data: HAS_DATA sends the screen to addExerciseToWorkout (the pick
 * goes in after it) instead, so a logged set never changes exercise under the
 * user. DUPLICATE: the pick is already one of the workout's exercises — the
 * program's own too, when it was added elsewhere in the workout after this
 * one was swapped away from it.
 */
export async function swapExercise(exerciseLogId: string, newExerciseId: string): Promise<ExerciseChangeResult> {
  const user = await requireUserOrThrow();
  if (typeof exerciseLogId !== "string" || typeof newExerciseId !== "string") return { ok: false, reason: "INVALID" };
  const result = await prisma.$transaction(async (tx) => {
    // Exclusive: a set typed on another device lands before the count below
    // (HAS_DATA), never under the swap onto the new exercise.
    const open = await lockOpenExerciseLog(tx, user.id, exerciseLogId, true);
    if (!open) return "CLOSED" as const;
    const target = await tx.exercise.findFirst({ where: { id: newExerciseId, isPublished: true }, select: { id: true } });
    if (!target) return "INVALID" as const;
    if (open.exerciseId === newExerciseId) return { sessionId: open.sessionId };
    const withData = await tx.setLog.count({ where: { exerciseLogId, ...SET_HAS_DATA } });
    if (withData > 0) return "HAS_DATA" as const;
    const log = await tx.workoutExerciseLog.findUniqueOrThrow({
      where: { id: exerciseLogId },
      select: { substitutedFromExerciseId: true, programExercise: { select: { notes: true } } },
    });
    const original = log.substitutedFromExerciseId ?? open.exerciseId;
    const back = newExerciseId === original;
    // This log doesn't hold the pick yet (checked above): any count is another copy of it.
    if ((await tx.workoutExerciseLog.count({ where: { sessionId: open.sessionId, exerciseId: newExerciseId } })) > 0) {
      return "DUPLICATE" as const;
    }
    await tx.workoutExerciseLog.update({
      where: { id: exerciseLogId },
      data: {
        exerciseId: newExerciseId,
        substitutedFromExerciseId: back ? null : original,
        notes: back ? (log.programExercise?.notes ?? null) : null,
        // A skipped exercise swapped for another: the stand-in is there to be done.
        wasSkipped: false,
      },
    });
    await tx.setLog.updateMany({ where: { exerciseLogId }, data: { exerciseId: newExerciseId } });
    return { sessionId: open.sessionId };
  });
  if (typeof result === "string") return { ok: false, reason: result };
  revalidatePath(`/app/workout/${result.sessionId}`);
  return { ok: true, exerciseLogId };
}

/** What a new exercise asks for when nothing else says so ("Adicionar exercício" at the end). */
const ADDED_EXERCISE_DEFAULTS = { prescribedSets: 3, repMin: 8, repMax: 12, rirTarget: 2, restSeconds: 90 };
/** A workout never grows past this many exercises. */
const MAX_WORKOUT_EXERCISES = 40;

/**
 * Adds an exercise to a workout in progress (W-006). With `after`, it goes
 * right after that exercise: `replacing` it (the swap of an exercise that
 * already has sets — "Adicionar como novo exercício") it takes that
 * exercise's prescription for the sets still to do and records it as the
 * stand-in (substitutedFromExerciseId); otherwise it copies nothing but the
 * rest. Without `after`, it goes at the end with a plain 3 × 8–12. Its set
 * rows are created like a started day's (see openSessionForDay). It isn't
 * part of the program (no program exercise): the program's default
 * progression applies. DUPLICATE: it is already one of the workout's
 * exercises — more of it goes there (extra sets), not in a second copy.
 */
export async function addExerciseToWorkout(
  sessionId: string,
  exerciseId: string,
  opts: { after?: string | null; replacing?: boolean } = {},
): Promise<ExerciseChangeResult> {
  const user = await requireUserOrThrow();
  if (typeof sessionId !== "string" || typeof exerciseId !== "string") return { ok: false, reason: "INVALID" };
  const afterId = typeof opts?.after === "string" ? opts.after : null;
  const result = await prisma.$transaction(async (tx) => {
    // Exclusive (see lockOpenExerciseLog): a second add of the same pick, from
    // another tap or device, waits for this one and then finds it (DUPLICATE).
    const [open] = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "WorkoutSession"
      WHERE id = ${sessionId} AND "userId" = ${user.id} AND status = 'IN_PROGRESS'
      FOR UPDATE`;
    if (!open) return "CLOSED" as const;
    const target = await tx.exercise.findFirst({ where: { id: exerciseId, isPublished: true }, select: { id: true } });
    if (!target) return "INVALID" as const;
    const logs = await tx.workoutExerciseLog.findMany({
      where: { sessionId },
      select: {
        id: true,
        exerciseId: true,
        substitutedFromExerciseId: true,
        sortOrder: true,
        prescribedSets: true,
        repMin: true,
        repMax: true,
        rirTarget: true,
        rpeTarget: true,
        restSeconds: true,
        tempo: true,
        groupKey: true,
        sets: { where: { setType: { not: "WARMUP" }, isExtra: false, ...SET_HAS_DATA }, select: { id: true } },
      },
    });
    if (logs.length >= MAX_WORKOUT_EXERCISES) return "INVALID" as const;
    if (logs.some((l) => l.exerciseId === exerciseId)) return "DUPLICATE" as const;
    const after = afterId ? logs.find((l) => l.id === afterId) : undefined;
    if (afterId && !after) return "INVALID" as const;
    const replacing = opts?.replacing === true && after !== undefined;
    const sortOrder = after ? after.sortOrder + 1 : Math.max(-1, ...logs.map((l) => l.sortOrder)) + 1;
    if (after) {
      await tx.workoutExerciseLog.updateMany({
        where: { sessionId, sortOrder: { gt: after.sortOrder } },
        data: { sortOrder: { increment: 1 } },
      });
    }
    const prescription = replacing
      ? {
          // The sets still to do move over: 1 of 3 done on the leg press leaves 2 for the hack.
          prescribedSets: Math.max(1, after.prescribedSets - after.sets.length),
          repMin: after.repMin,
          repMax: after.repMax,
          rirTarget: after.rirTarget,
          rpeTarget: after.rpeTarget,
          restSeconds: after.restSeconds,
          tempo: after.tempo,
          // A stand-in keeps its place in a superset (W-104).
          groupKey: after.groupKey,
        }
      : { ...ADDED_EXERCISE_DEFAULTS, restSeconds: after?.restSeconds ?? ADDED_EXERCISE_DEFAULTS.restSeconds };
    const log = await tx.workoutExerciseLog.create({
      data: {
        sessionId,
        userId: user.id,
        exerciseId,
        sortOrder,
        ...prescription,
        warmupSets: 0,
        substitutedFromExerciseId: replacing ? (after.substitutedFromExerciseId ?? after.exerciseId) : null,
      },
      select: { id: true },
    });
    await tx.setLog.createMany({
      data: Array.from({ length: prescription.prescribedSets }, (_, i) => ({
        userId: user.id,
        sessionId,
        exerciseLogId: log.id,
        exerciseId,
        setNumber: i + 1,
        setType: "WORKING" as const,
      })),
    });
    return { logId: log.id };
  });
  if (typeof result === "string") return { ok: false, reason: result };
  revalidatePath(`/app/workout/${sessionId}`);
  return { ok: true, exerciseLogId: result.logId };
}

/**
 * "Usar no programa" on a finished workout's swap (W-006): the program day
 * asks for the exercise done in its place from now on — when it still asks
 * for the one that was swapped out (idempotent: a second tap, or a program
 * already changed, does nothing). The day's note for the old exercise goes
 * (it would coach the wrong movement — and a "segure 30 s" would time the new
 * one in seconds). Workouts already open keep their snapshot. The program
 * counts as saved now: a builder draft kept on this device from before reads
 * as older than the program, not as its latest version.
 */
export async function keepSwapInProgram(exerciseLogId: string): Promise<{ ok: boolean }> {
  const user = await requireUserOrThrow();
  if (typeof exerciseLogId !== "string") return { ok: false };
  const log = await prisma.workoutExerciseLog.findFirst({
    where: { id: exerciseLogId, userId: user.id, session: { status: "COMPLETED" } },
    select: {
      sessionId: true,
      exerciseId: true,
      substitutedFromExerciseId: true,
      programExercise: { select: { id: true, exerciseId: true, day: { select: { programId: true, program: { select: { userId: true } } } } } },
    },
  });
  const pe = log?.programExercise;
  if (!log || !pe || pe.day.program.userId !== user.id || !log.substitutedFromExerciseId) return { ok: false };
  const from = log.substitutedFromExerciseId;
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.userProgramExercise.updateMany({
      where: { id: pe.id, exerciseId: from },
      data: { exerciseId: log.exerciseId, notes: null },
    });
    // The builder's local draft is judged against the program's updatedAt (draftIsStale).
    if (changed.count > 0) await tx.userProgram.update({ where: { id: pe.day.programId }, data: { updatedAt: new Date() } });
    return changed;
  });
  if (updated.count > 0) {
    revalidatePath(`/app/programs/${pe.day.programId}`);
    revalidatePath("/app/today");
  }
  revalidatePath(`/app/workout/${log.sessionId}/summary`);
  return { ok: updated.count > 0 || pe.exerciseId === log.exerciseId };
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

export type FinishResult =
  | { ok: true; summaryUrl: string }
  | { ok: false; reason: "EMPTY" | "NOT_FOUND" };
/** A finish that opens the summary itself: it only comes back when it didn't go through. */
export type FinishFailure = Extract<FinishResult, { ok: false }>;

/** Past this much wall time, the clock since "Iniciar" says nothing about the training itself. */
const LONG_SESSION_MS = MAX_BOUT_SECONDS * 1000;

/**
 * Finishes the session. A row with load and reps is a set the user did: rows
 * typed but never confirmed with ✓ — sent in `pending` from this device, or
 * autosaved earlier from any device — are saved and counted instead of
 * silently dropped (skipped exercises keep only what was ✓'d). A session with
 * no working set recorded is not finished (EMPTY): that used to count as a
 * completed program day and wipe "Último treino". Idempotent: finishing an
 * already finished session just opens its summary. On success it opens the
 * summary itself (see openSummary); only a failure comes back.
 *
 * A session open for more than 4 h is timed by its last bout of sets (see
 * lib/training/stale.ts: split where 2 h+ passed between two sets, at most
 * 4 h) instead of by the clock since it was started — a workout left open on
 * Monday and continued on Thursday is timed by Thursday's sets, not 72 h.
 */
export async function finishWorkoutSession(sessionId: string, pending: LogSetInput[] = []): Promise<FinishFailure> {
  const user = await requireUserOrThrow();
  return openSummary(await finishSession(user.id, sessionId, pending, "now"));
}

/**
 * Finishes a workout that was left open (see lib/training/stale.ts) as done on
 * its own day: same saving, EMPTY and locking rules as finishWorkoutSession,
 * but dated and timed by its first bout of sets (staleSaveTiming: the end of
 * that bout, start + 1 h without set times), and advancing the program as of
 * that date — so a Monday workout closed on Friday never lands in Friday's
 * week with a 97-hour duration. Sets added later ("Continuar hoje") still
 * count in its totals without stretching its date or duration. Returns its
 * result (Today's "Salvar como feito em …" stays on Today); the workout
 * screen uses finishStaleWorkoutSessionAndOpen.
 */
export async function finishStaleWorkoutSession(sessionId: string, pending: LogSetInput[] = []): Promise<FinishResult> {
  const user = await requireUserOrThrow();
  return finishSession(user.id, sessionId, pending, "stale");
}

/** finishStaleWorkoutSession from the workout screen: opens the summary like finishWorkoutSession. */
export async function finishStaleWorkoutSessionAndOpen(sessionId: string, pending: LogSetInput[] = []): Promise<FinishFailure> {
  const user = await requireUserOrThrow();
  return openSummary(await finishSession(user.id, sessionId, pending, "stale"));
}

/**
 * A finished workout goes straight to its summary from inside the action: the
 * summary arrives in the action's own response (one round trip, instead of
 * the action and then the summary's fetch). Failures come back to the screen.
 */
function openSummary(r: FinishResult): FinishFailure {
  if (r.ok) redirect(r.summaryUrl, RedirectType.replace);
  return r;
}

async function finishSession(
  userId: string,
  sessionId: string,
  pending: LogSetInput[],
  mode: "now" | "stale",
): Promise<FinishResult> {
  if (typeof sessionId !== "string") return { ok: false, reason: "NOT_FOUND" };
  const summaryUrl = `/app/workout/${sessionId}/summary`;
  const drafts = (Array.isArray(pending) ? pending : []).slice(0, 400);
  const now = new Date();
  let finishedAt = now;
  let blockClosed = false;

  const outcome = await prisma.$transaction(async (tx) => {
    // Lock the session row: concurrent set writes (FOR SHARE) and a second
    // finish from another tab wait here and then see it closed.
    const [row] = await tx.$queryRaw<{ status: string; startedAt: Date }[]>`
      SELECT status::text AS status, "startedAt" FROM "WorkoutSession"
      WHERE id = ${sessionId} AND "userId" = ${userId}
      FOR UPDATE`;
    if (!row) return "GONE" as const;
    if (row.status === "COMPLETED") return "ALREADY" as const;
    if (row.status !== "IN_PROGRESS") return "GONE" as const;

    const openRows = { sessionId, userId, exerciseLog: { wasSkipped: false } };
    /** ✓ taps from this device that hadn't reached the server yet: their sets keep that time. */
    const tapped = new Map<string, Date>();
    const draftIds = drafts.filter((d) => d && typeof d.setLogId === "string").map((d) => d.setLogId);
    const current = new Map(
      (draftIds.length === 0
        ? []
        : await tx.setLog.findMany({
            where: { sessionId, userId, id: { in: draftIds } },
            select: {
              id: true,
              weightKg: true,
              reps: true,
              rir: true,
              isCompleted: true,
              exerciseLog: { select: { wasSkipped: true } },
            },
          })
      ).map((r) => [r.id, r]),
    );
    for (const d of drafts) {
      const saved = d && typeof d.setLogId === "string" ? current.get(d.setLogId) : undefined;
      if (!saved) continue;
      const tap = clampNum(d.completedAtMs, row.startedAt.getTime(), now.getTime());
      if (tap !== null) tapped.set(d.setLogId, new Date(tap));
      // In a skipped exercise only rows already ✓'d can still be edited.
      if (saved.exerciseLog.wasSkipped && !saved.isCompleted) continue;
      const values = cleanValues(d);
      const uncount = saved.isCompleted && !isFilled(values);
      // Rewriting a row with what it already holds would bump its updatedAt —
      // the time an unconfirmed row is dated by — to now.
      const changed = values.weightKg !== saved.weightKg || values.reps !== saved.reps || values.rir !== saved.rir;
      if (!changed && !uncount) continue;
      await tx.setLog.update({
        where: { id: saved.id },
        data: { ...values, ...(uncount ? { isCompleted: false, completedAt: null } : {}) },
      });
    }
    // Every filled row of a non-skipped exercise counts, whether or not ✓ was
    // tapped and wherever it was typed (another device, a lost local mirror).
    // It is dated by its ✓ tap if one is pending, else when it was last typed —
    // the best record of when it was done.
    const unconfirmed = await tx.setLog.findMany({
      where: { ...openRows, isCompleted: false, weightKg: { not: null }, reps: { gte: 1 } },
      select: { id: true, updatedAt: true },
    });
    for (const r of unconfirmed) {
      const completedAt = tapped.get(r.id) ?? (r.updatedAt < now ? r.updatedAt : now);
      await tx.setLog.update({ where: { id: r.id }, data: { isCompleted: true, completedAt } });
    }

    const session = await tx.workoutSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: { setLogs: true, enrollment: true },
    });
    if (workingSetCount(session.setLogs) === 0) return "EMPTY" as const;

    const startedMs = session.startedAt.getTime();
    const setTimes = session.setLogs.filter((s) => s.isCompleted && s.completedAt).map((s) => s.completedAt as Date);
    let durationSeconds = Math.max(0, Math.round((now.getTime() - startedMs) / 1000));
    if (mode === "stale") {
      const timing = staleSaveTiming(session.startedAt, setTimes, now);
      finishedAt = timing.finishedAt;
      durationSeconds = timing.durationSeconds;
    } else if (now.getTime() - startedMs > LONG_SESSION_MS) {
      const bouts = setBouts(setTimes);
      const last = bouts[bouts.length - 1];
      durationSeconds = last ? boutSeconds(last) : MAX_BOUT_SECONDS;
    }

    await tx.workoutSession.update({
      where: { id: sessionId },
      data: {
        status: "COMPLETED",
        finishedAt,
        durationSeconds,
        totalVolumeKg: sessionVolumeKg(session.setLogs),
        totalWorkingSets: workingSetCount(session.setLogs),
        totalReps: totalReps(session.setLogs),
      },
    });

    if (session.enrollment && session.enrollment.status === "ACTIVE" && session.programId) {
      blockClosed = await advanceProgram(tx, {
        userId,
        sessionId,
        enrollment: session.enrollment,
        programId: session.programId,
        session,
        now: finishedAt,
      });
    }
    return "FLIPPED" as const;
  });

  if (outcome === "GONE") return { ok: false, reason: "NOT_FOUND" };
  if (outcome === "EMPTY") return { ok: false, reason: "EMPTY" };
  let published = false;
  if (outcome === "FLIPPED") {
    try {
      await checkAndRecordPersonalRecords(userId, sessionId);
      // Records are stamped "now"; a workout saved on its own day keeps that day.
      if (finishedAt !== now) {
        await prisma.exercisePersonalRecord.updateMany({ where: { userId, sessionId }, data: { achievedAt: finishedAt } });
      }
    } catch (err) {
      // The workout is saved; a PR bookkeeping failure must not look like a failed finish.
      console.error("PR recording failed", sessionId, err);
    }
    let milestone: number | null = null;
    try {
      // The 10th/25th/50th/100th workout: a private milestone (the summary stamps its number).
      milestone = await recordWorkoutMilestone(userId, sessionId);
    } catch (err) {
      console.error("Milestone recording failed", sessionId, err);
    }
    // Publishing and the achievements log, after the records (the card lists them).
    published = (await afterFinish({ userId, sessionId, finishedAt, now, milestone })).activityId !== null;
  }

  revalidatePath("/app/today");
  revalidatePath("/app/history");
  if (blockClosed) revalidatePath("/app/programs");
  if (published) revalidatePath("/app/feed");
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
 * - `now` is when the workout counts as done: a workout left open and saved
 *   later on its own day counts in that day's week. If newer workouts already
 *   moved the program on, it only adds to the count and never winds it back.
 * - The block ends (COMPLETED, see program-lifecycle.ts closeBlock) with the
 *   workout that completes its last week, or with the first one past it —
 *   closed before that workout takes a week: it's saved in the block's last
 *   week, never in one past the duration. The entry week of a program
 *   started Thursday–Sunday doesn't count toward its duration
 *   (program-calendar.ts) when it was trained; untrained, it never took a
 *   week number (block-progress countedWeeks). A redo after that isn't
 *   linked to an active enrollment, so it never ends the block again.
 *   Returns whether this workout ended it.
 */
async function advanceProgram(
  tx: Tx,
  s: {
    userId: string;
    sessionId: string;
    enrollment: { id: string; currentWeek: number; nextDayIndex: number; startedAt: Date };
    programId: string;
    session: { programDayId: string | null; programDayIndex: number | null; name: string };
    now: Date;
  },
): Promise<boolean> {
  const program = await tx.userProgram.findUnique({
    where: { id: s.programId },
    include: { days: { orderBy: { dayIndex: "asc" }, include: { _count: { select: { exercises: true } } } } },
  });
  if (!program || program.days.length === 0) return false;
  const days = program.days;

  // userId keeps these on the (userId, …) indexes.
  const finished = {
    userId: s.userId,
    enrollmentId: s.enrollment.id,
    status: "COMPLETED" as const,
    totalWorkingSets: { gt: 0 },
    id: { not: s.sessionId },
  };
  const newer = await tx.workoutSession.findFirst({
    where: { ...finished, finishedAt: { gt: s.now } },
    select: { programWeek: true },
    orderBy: { finishedAt: "asc" },
  });
  if (newer) {
    await tx.workoutSession.update({
      where: { id: s.sessionId },
      data: { programWeek: newer.programWeek ?? s.enrollment.currentWeek },
    });
    await tx.programEnrollment.update({ where: { id: s.enrollment.id }, data: { completedSessions: { increment: 1 } } });
    return false;
  }

  const thisWeek = await tx.workoutSession.findMany({
    where: { ...finished, finishedAt: { gte: startOfWeek(s.now), lte: s.now } },
    select: { programDayId: true, programDayIndex: true, name: true },
  });
  let week = s.enrollment.currentWeek;
  if (thisWeek.length === 0 && (await tx.workoutSession.findFirst({ where: finished, select: { id: true } }))) {
    week += 1;
  }
  // This workout is saved as finished already: it counts if it was done in the entry week.
  const entryWeekTrained = await entryWeekWasTrained(tx, { id: s.enrollment.id, userId: s.userId, startedAt: s.enrollment.startedAt });

  // The first workout past the block's last week: the block is over. It closes
  // first, and the workout is kept in the block's last week — never a "Semana
  // 5" of a 4-week block — as a late workout of it (a day of that week left
  // over, done now).
  if (program.durationWeeks && countedWeeks(week, s.enrollment.startedAt, entryWeekTrained) > program.durationWeeks) {
    await tx.workoutSession.update({ where: { id: s.sessionId }, data: { programWeek: s.enrollment.currentWeek } });
    await tx.programEnrollment.update({ where: { id: s.enrollment.id }, data: { completedSessions: { increment: 1 } } });
    return closeBlock(tx, { userId: s.userId, enrollmentId: s.enrollment.id, now: s.now });
  }

  const thisDay = resolveSessionDay(s.session, days);
  const nextDayIndex = thisDay ? nextDayAfter(days, program.daysPerWeek, thisDay, thisWeek) : s.enrollment.nextDayIndex;

  await tx.workoutSession.update({ where: { id: s.sessionId }, data: { programWeek: week } });
  await tx.programEnrollment.update({
    where: { id: s.enrollment.id },
    data: { completedSessions: { increment: 1 }, nextDayIndex, currentWeek: week },
  });

  if (!program.durationWeeks) return false;
  // Where this week stands now (Today's rule), for the block's last week.
  const doneDayIds = new Set(thisWeek.flatMap((x) => resolveSessionDay(x, days)?.id ?? []));
  if (thisDay) doneDayIds.add(thisDay.id);
  const { weekComplete } = planWeek({
    days,
    isTrainable: (d) => d._count.exercises > 0,
    nextDayIndex,
    daysPerWeek: program.daysPerWeek,
    doneDayIds,
    sessionCount: thisWeek.length + 1,
  });
  if (!blockEnds({ week, startedAt: s.enrollment.startedAt, durationWeeks: program.durationWeeks, weekComplete, entryWeekTrained })) {
    return false;
  }
  return closeBlock(tx, { userId: s.userId, enrollmentId: s.enrollment.id, now: s.now });
}

/**
 * The program day suggested after `thisDay` was trained, with `weekSoFar` the
 * other workouts finished in its calendar week (advanceProgram's rule):
 * - programs that repeat days within a week (A/B at 3×) just rotate;
 * - otherwise the next day not yet done this week — once all of them are, a
 *   weekday-named plan starts again on its first day, and any other rotation
 *   (Sessão A/B/C) continues after the day trained, so a week begun at B
 *   doesn't end up with A twice in a row.
 */
function nextDayAfter<D extends { id: string; dayIndex: number; name: string }>(
  days: D[],
  daysPerWeek: number,
  thisDay: D,
  weekSoFar: { programDayId: string | null; programDayIndex: number | null; name: string }[],
): number {
  const pos = days.indexOf(thisDay);
  const order = days.map((_, i) => days[(pos + 1 + i) % days.length]);
  if (daysPerWeek > days.length) return order[0].dayIndex;
  const doneIds = new Set(weekSoFar.map((x) => resolveSessionDay(x, days)?.id));
  doneIds.add(thisDay.id);
  const weekDone = restartsEachWeek(days, daysPerWeek) ? days[0] : order[0];
  return (order.find((d) => !doneIds.has(d.id)) ?? weekDone).dayIndex;
}

// ---------------------------------------------------------------------------
// Correcting a finished workout (W-088): its sets can be edited, or the whole
// workout deleted, for FINISHED_EDIT_WINDOW_MS after it was saved (savedAt:
// a workout saved later "como feito em 20/09" too). Records, the week's count
// and the program's counters follow, by the same rules that made them at the
// finish.
// ---------------------------------------------------------------------------

/** One row of "Editar séries": new values for a set that counted, or `remove` to take it out. */
export interface FinishedSetEdit {
  setLogId: string;
  weightKg: number | null;
  reps: number | null;
  rir: number | null;
  remove?: boolean;
}

/**
 * EXPIRED: past the correction window; EMPTY: the edit would leave no working
 * set (delete the workout instead); INVALID: a row without load and reps, or
 * not one of the workout's sets.
 */
export type FinishedEditResult = { ok: false; reason: "NOT_FOUND" | "EXPIRED" | "EMPTY" | "INVALID" };

/**
 * Locks a finished workout of the user's for a correction: NOT_FOUND when it
 * isn't one, EXPIRED once the window since it was saved closed (savedAt).
 */
async function lockFinished(tx: Tx, userId: string, sessionId: string) {
  const [row] = await tx.$queryRaw<{ status: string; finishedAt: Date | null; updatedAt: Date }[]>`
    SELECT status::text AS status, "finishedAt", "updatedAt" FROM "WorkoutSession"
    WHERE id = ${sessionId} AND "userId" = ${userId}
    FOR UPDATE`;
  if (!row || row.status !== "COMPLETED" || !row.finishedAt) return "NOT_FOUND" as const;
  if (!isStillEditable({ finishedAt: row.finishedAt, updatedAt: row.updatedAt })) return "EXPIRED" as const;
  return { finishedAt: row.finishedAt, updatedAt: row.updatedAt };
}

/**
 * Re-judges the records of finished workouts — each against the workouts
 * finished before it (checkAndRecordPersonalRecords, idempotent) — dated on
 * their own finish, as the finish dates them. Run on a corrected workout and
 * on the later ones that share an exercise with it: a typo's "record" no
 * longer stands in their way, and a record measured against a deleted
 * workout is measured again. Each one's shared card is rebuilt after it (a
 * card lists the workout's records, and its totals after an edit), so the
 * feed never shows a record that no longer stands or misses one that does.
 */
async function rescoreRecords(userId: string, sessionIds: string[]) {
  for (const id of sessionIds) {
    try {
      await checkAndRecordPersonalRecords(userId, id);
      const s = await prisma.workoutSession.findUnique({ where: { id }, select: { finishedAt: true } });
      if (s?.finishedAt) {
        await prisma.exercisePersonalRecord.updateMany({ where: { userId, sessionId: id }, data: { achievedAt: s.finishedAt } });
      }
    } catch (err) {
      // The correction is saved; a record bookkeeping failure must not look like a failed save.
      console.error("PR rescoring failed", id, err);
    }
    try {
      // Outside the rescoring's try: an edited workout's card still gets its corrected totals.
      await refreshSharedCard(id);
    } catch (err) {
      console.error("Shared card refresh failed", id, err);
    }
  }
}

/** Finished workouts after `finishedAt` that have one of `exerciseIds`, oldest first. */
function laterWorkoutsWith(userId: string, exerciseIds: string[], finishedAt: Date) {
  if (exerciseIds.length === 0) return Promise.resolve([] as string[]);
  return prisma.workoutSession
    .findMany({
      where: {
        userId,
        status: "COMPLETED",
        finishedAt: { gt: finishedAt },
        exerciseLogs: { some: { exerciseId: { in: exerciseIds } } },
      },
      orderBy: { finishedAt: "asc" },
      select: { id: true },
    })
    .then((rows) => rows.map((r) => r.id));
}

/**
 * "Editar séries" on a finished workout: each row keeps its load, reps and
 * RIR as corrected (a row needs load and reps), or is taken out. The totals,
 * the shared card and the records follow; the program's counters don't move
 * (the day is still done) — which is why an edit may not leave the workout
 * without a working set: that is "Excluir treino". Opens the summary on
 * success; only a failure comes back.
 */
export async function editFinishedWorkout(sessionId: string, edits: FinishedSetEdit[]): Promise<FinishedEditResult> {
  const user = await requireUserOrThrow();
  if (typeof sessionId !== "string" || !Array.isArray(edits)) return { ok: false, reason: "INVALID" };
  const rows = edits.filter((e) => e && typeof e.setLogId === "string").slice(0, 400);

  const outcome = await prisma
    .$transaction(async (tx) => {
      const locked = await lockFinished(tx, user.id, sessionId);
      if (typeof locked === "string") return locked;
      const sets = await tx.setLog.findMany({
        where: { sessionId, userId: user.id, id: { in: rows.map((r) => r.setLogId) } },
        select: { id: true, setType: true, isCompleted: true, weightKg: true, reps: true, rir: true, exerciseId: true },
      });
      const byId = new Map(sets.map((s) => [s.id, s]));
      for (const edit of rows) {
        const set = byId.get(edit.setLogId);
        // Only the sets the summary lists: working sets that counted.
        if (!set || set.setType === "WARMUP" || !set.isCompleted) return "INVALID" as const;
        if (edit.remove === true) {
          await tx.setLog.update({
            where: { id: set.id },
            data: { isCompleted: false, completedAt: null, weightKg: null, reps: null, rir: null },
          });
          continue;
        }
        const values = cleanValues(edit);
        if (!isFilled(values)) return "INVALID" as const;
        if (values.weightKg === set.weightKg && values.reps === set.reps && values.rir === set.rir) continue;
        await tx.setLog.update({ where: { id: set.id }, data: values });
      }
      const all = await tx.setLog.findMany({ where: { sessionId } });
      if (workingSetCount(all) === 0) throw new EmptyEdit();
      await tx.workoutSession.update({
        where: { id: sessionId },
        data: {
          totalVolumeKg: sessionVolumeKg(all),
          totalWorkingSets: workingSetCount(all),
          totalReps: totalReps(all),
          // Kept: it dates the save the correction window runs from (savedAt) — a correction doesn't extend it.
          updatedAt: locked.updatedAt,
        },
      });
      return { finishedAt: locked.finishedAt, exerciseIds: [...new Set(sets.map((s) => s.exerciseId))] };
    })
    .catch((err) => {
      if (err instanceof EmptyEdit) return "EMPTY" as const;
      throw err;
    });
  if (typeof outcome === "string") return { ok: false, reason: outcome };

  // Its own card is rebuilt there too, with the corrected totals.
  const rescored = [sessionId, ...(await laterWorkoutsWith(user.id, outcome.exerciseIds, outcome.finishedAt))];
  await rescoreRecords(user.id, rescored);
  await afterRescore(user.id, rescored);
  revalidateFinished(sessionId);
  redirect(`/app/workout/${sessionId}/summary?corrigido=1`, RedirectType.replace);
}

/** Thrown inside the edit's transaction to roll it back when no working set would be left. */
class EmptyEdit extends Error {}

/** A shared workout's card is built from its sets and records (activities.ts): rebuilt after a correction. */
async function refreshSharedCard(sessionId: string) {
  // Most rescored workouts were never shared: those load nothing.
  const session = await prisma.workoutSession.findFirst({
    where: { id: sessionId, activity: { isNot: null } },
    include: {
      exerciseLogs: { include: { exercise: true, sets: true }, orderBy: { sortOrder: "asc" } },
      records: { include: { exercise: true } },
      activity: { select: { id: true, showDetailedLoads: true } },
    },
  });
  if (!session?.activity) return;
  const summary = buildWorkoutActivitySummary(session, session.activity.showDetailedLoads);
  await prisma.activity.update({ where: { id: session.activity.id }, data: { summary: summary as never } });
}

function revalidateFinished(sessionId: string) {
  revalidatePath(`/app/workout/${sessionId}/summary`);
  revalidatePath("/app/today");
  revalidatePath("/app/history");
  revalidatePath("/app/progress");
  revalidatePath("/app/feed");
  revalidatePath("/app/programs");
}

/**
 * "Excluir treino" (W-088): deletes a finished workout — its sets, records
 * and shared card go with it (cascade) — and puts back what finishing it
 * moved: the program's workout count, and, when it was the program's latest
 * workout, the program week and the suggested next day as they stand after
 * the workout before it (advanceProgram's own rule, nextDayAfter; with no
 * workout before it, the block's first day is next again, as when it was
 * started — and the week stays: a first workout never moves it). A block
 * this workout closed is open again when nothing else became active since.
 * A workout that alone took its program week takes that week with it: the
 * later ones go back one (see rollBackProgram). Its milestone stamp goes too.
 * The later workouts' records are judged again without it, and their shared
 * cards follow. Opens Today on success; only a failure comes back.
 */
export async function deleteWorkoutSession(sessionId: string): Promise<FinishedEditResult> {
  const user = await requireUserOrThrow();
  if (typeof sessionId !== "string") return { ok: false, reason: "NOT_FOUND" };

  const outcome = await prisma.$transaction(async (tx) => {
    const locked = await lockFinished(tx, user.id, sessionId);
    if (typeof locked === "string") return locked;
    const session = await tx.workoutSession.findUniqueOrThrow({
      where: { id: sessionId },
      select: { id: true, enrollmentId: true, programWeek: true, exerciseLogs: { select: { exerciseId: true } } },
    });
    if (session.enrollmentId) await rollBackProgram(tx, user.id, { ...session, finishedAt: locked.finishedAt });
    await tx.activity.deleteMany({
      where: { userId: user.id, type: "MILESTONE", summary: { path: ["sessionId"], equals: sessionId } },
    });
    await tx.workoutSession.delete({ where: { id: sessionId } });
    return { finishedAt: locked.finishedAt, exerciseIds: [...new Set(session.exerciseLogs.map((l) => l.exerciseId))] };
  });
  if (typeof outcome === "string") return { ok: false, reason: outcome };

  const later = await laterWorkoutsWith(user.id, outcome.exerciseIds, outcome.finishedAt);
  await rescoreRecords(user.id, later);
  // Its own notifications went with it (Notification.sessionId cascades).
  await afterRescore(user.id, later);
  revalidateFinished(sessionId);
  redirect("/app/today?excluido=1", RedirectType.replace);
}

/**
 * Undoes what advanceProgram did for a deleted workout (see
 * deleteWorkoutSession). The workout count is counted again — the block's
 * finished workouts without this one (program-lifecycle FINISHED, as block
 * progress counts them) — instead of taken down by one: a workout finished
 * after its enrollment stopped was linked to it but never added.
 */
async function rollBackProgram(
  tx: Tx,
  userId: string,
  s: { id: string; enrollmentId: string | null; finishedAt: Date; programWeek: number | null },
) {
  if (!s.enrollmentId) return;
  const enrollment = await tx.programEnrollment.findFirst({
    where: { id: s.enrollmentId, userId },
    select: { id: true, status: true, endedAt: true, programId: true, currentWeek: true, nextDayIndex: true },
  });
  if (!enrollment) return;
  // userId keeps these on the (userId, …) indexes.
  const finished = {
    userId,
    enrollmentId: enrollment.id,
    status: "COMPLETED" as const,
    totalWorkingSets: { gt: 0 },
    id: { not: s.id },
  };
  const data: Prisma.ProgramEnrollmentUpdateInput = { completedSessions: await tx.workoutSession.count({ where: finished }) };

  // Closed by this workout (closeBlock stamps the workout's own finish) and
  // nothing started since: the block goes on — and its program is the running
  // one again, whatever it became meanwhile ("Restaurar" or a builder save
  // make an archived program a draft, which "Descartar rascunho" would delete).
  let active = enrollment.status === "ACTIVE";
  if (
    enrollment.status === "COMPLETED" &&
    enrollment.endedAt &&
    Math.abs(enrollment.endedAt.getTime() - s.finishedAt.getTime()) < 1000 &&
    (await tx.programEnrollment.count({ where: { userId, status: "ACTIVE" } })) === 0
  ) {
    active = true;
    data.status = "ACTIVE";
    data.endedAt = null;
    await tx.userProgram.updateMany({
      where: { id: enrollment.programId, userId, status: { not: "ACTIVE" } },
      data: { status: "ACTIVE", archivedAt: null },
    });
    await tx.activity.deleteMany({
      where: { userId, type: "PROGRAM_COMPLETED", summary: { path: ["enrollmentId"], equals: enrollment.id } },
    });
  }

  if (active) {
    const newer = await tx.workoutSession.findFirst({ where: { ...finished, finishedAt: { gt: s.finishedAt } }, select: { id: true } });
    if (newer) {
      // A later workout already moved the program on from where this one left
      // it — past this one's week, though, only because this one was there,
      // when it alone took that week (the first and only workout of its
      // calendar week: the block's first, or the one that moved the counter
      // on). Without it that week was never trained: the later workouts and
      // the counter go back one, as they would stand had it never been saved
      // (a Sunday workout deleted after Monday's). One that shares its week —
      // a redo, a late save that took a newer workout's week, a late workout
      // kept in the block's last week — moved nothing.
      const week = s.programWeek;
      if (week != null && (await tx.workoutSession.count({ where: { ...finished, programWeek: week } })) === 0) {
        // Raw SQL keeps their updatedAt: their own correction window runs from it.
        await tx.$executeRaw`
          UPDATE "WorkoutSession" SET "programWeek" = "programWeek" - 1
          WHERE "userId" = ${userId} AND "enrollmentId" = ${enrollment.id} AND status = 'COMPLETED'
            AND id <> ${s.id} AND "finishedAt" > ${s.finishedAt} AND "programWeek" > ${week}`;
        if (enrollment.currentWeek > week) data.currentWeek = Math.max(1, enrollment.currentWeek - 1);
      }
    } else {
      const program = await tx.userProgram.findUnique({
        where: { id: enrollment.programId },
        select: { daysPerWeek: true, days: { orderBy: { dayIndex: "asc" }, select: { id: true, dayIndex: true, name: true } } },
      });
      const days = program?.days ?? [];
      const before = await tx.workoutSession.findFirst({
        where: { ...finished, finishedAt: { lt: s.finishedAt } },
        orderBy: { finishedAt: "desc" },
        select: { programWeek: true, programDayId: true, programDayIndex: true, name: true, finishedAt: true },
      });
      const beforeDay = before ? resolveSessionDay(before, days) : undefined;
      if (before && program && beforeDay && before.finishedAt) {
        const weekSoFar = await tx.workoutSession.findMany({
          where: { ...finished, finishedAt: { gte: startOfWeek(before.finishedAt), lt: before.finishedAt } },
          select: { programDayId: true, programDayIndex: true, name: true },
        });
        data.nextDayIndex = nextDayAfter(days, program.daysPerWeek, beforeDay, weekSoFar);
      } else if (!before && days.length > 0) {
        // The block's first workout: next is where the block started (startProgramInternal).
        data.nextDayIndex = days[0].dayIndex;
      }
      if (before?.programWeek != null) data.currentWeek = before.programWeek;
    }
  }
  await tx.programEnrollment.update({ where: { id: enrollment.id }, data });
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
