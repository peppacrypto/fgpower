"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { getTemplateBySlug } from "@/lib/data/templates";
import { adaptRepRange, adaptRowKey } from "@/lib/data/alternatives";
import { findUndoableSwitch } from "@/lib/data/dashboard";
import { applyWeekLayout, getProgramRestart } from "@/lib/data/program-lifecycle";
import { isUntouchedFork } from "@/lib/data/user-programs";
import { startAdHocWorkoutSession } from "@/lib/actions/workouts";
import { seriesPosition } from "@/lib/training/program-calendar";
import { MAX_PROGRAMS_PER_USER, normalizeProgramName } from "@/lib/validation/program-builder";
// Fork + activation live in lib/programming/enroll so the onboarding auto-enroll
// shares the exact same code without exposing these userId-taking helpers as
// client-callable server actions.
import { forkTemplateToProgram, setAsOnlyActiveProgram, startProgramInternal, SET_HAS_DATA } from "@/lib/programming/enroll";
import { goalFilterForTrack, trackOf } from "@/lib/programming/tracks";

/**
 * Refuses a new program once the account already holds MAX_PROGRAMS_PER_USER
 * non-archived ones (A-003). Sends the user back to the shelf with a notice
 * rather than throwing — they free room by archiving or deleting. Only the
 * user-initiated create/fork paths call this; starting, resuming or repeating
 * a program is never blocked.
 */
async function enforceProgramQuota(userId: string) {
  const count = await prisma.userProgram.count({ where: { userId, status: { in: ["DRAFT", "ACTIVE"] } } });
  if (count >= MAX_PROGRAMS_PER_USER) redirect("/app/programs?limite=1");
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

/**
 * "Personalizar": the user's own copy of a template, in the editor. It used to
 * fork a fresh draft on every tap — peeking twice left two "Rascunho" copies,
 * and on the template already running it made a second one that restarted at
 * week 1. Now: the running program is edited in place; an untouched copy from
 * an earlier tap (same template version, never saved or trained) is reopened;
 * only otherwise is a new copy made.
 */
export async function customizeTemplate(templateSlug: string) {
  const user = await requireUserOrThrow();
  const template = await prisma.workoutTemplate.findUnique({
    where: { slug: String(templateSlug) },
    select: { id: true, version: true, namePt: true },
  });
  if (!template) redirect("/app/programs");

  const running = await prisma.programEnrollment.findFirst({
    where: { userId: user.id, status: "ACTIVE", program: { sourceTemplateId: template.id } },
    orderBy: { startedAt: "desc" },
    select: { programId: true },
  });
  if (running) redirect(`/app/programs/${running.programId}/edit`);

  const untouched = await findUntouchedCopy(user.id, template);
  if (untouched) redirect(`/app/programs/${untouched}/edit`);

  await enforceProgramQuota(user.id);
  const program = await forkTemplateToProgram(templateSlug, user.id);
  redirect(`/app/programs/${program.id}/edit`);
}

/**
 * A copy of the template made by an earlier "Personalizar" and never saved or
 * trained since. Only a plain copy counts: "Adaptar" and "Duplicar" copies
 * carry the template too, but under their own name ("… (adaptado)",
 * "… (cópia)") and with the user's choices in them.
 */
async function findUntouchedCopy(userId: string, template: { id: string; version: number; namePt: string }) {
  const drafts = await prisma.userProgram.findMany({
    where: {
      userId,
      sourceTemplateId: template.id,
      sourceTemplateVersion: template.version,
      name: template.namePt,
      status: "DRAFT",
      sessions: { none: {} },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, createdAt: true, updatedAt: true },
  });
  return drafts.find(isUntouchedFork)?.id ?? null;
}

/**
 * "Adaptar para halteres" (the dossier's review page): a copy of the template
 * with the exercises the user's equipment can't do swapped for the ones they
 * chose on the review — `swap:<row>` = the exercise to use, or "keep". Only
 * published exercises are taken. Lands in the builder.
 *
 * A row is named by its day, place and exercise (adaptRowKey), not by its
 * WorkoutTemplateExercise id, which every reseed recreates. A name the
 * template no longer has (it changed while the review was open) sends the
 * user back to review it again rather than saving a copy without their swaps.
 */
export async function adaptTemplate(templateSlug: string, formData: FormData) {
  const user = await requireUserOrThrow();
  const template = await getTemplateBySlug(String(templateSlug));
  if (!template) redirect("/app/programs");

  const rows = new Map(template.days.flatMap((d) => d.exercises.map((ex) => [adaptRowKey(d.dayIndex, ex), ex] as const)));
  const wanted = new Map<string, string>();
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("swap:") || typeof value !== "string") continue;
    const rowKey = key.slice(5);
    const row = rows.get(rowKey);
    if (!row) redirect(`/app/programs/templates/${template.slug}/adapt?mudou=1`);
    if (value && value !== "keep" && value !== row.exerciseId) wanted.set(rowKey, value.slice(0, 64));
  }
  const subs = new Map(
    (
      await prisma.exercise.findMany({
        where: { id: { in: [...new Set(wanted.values())] }, isPublished: true },
        select: { id: true, difficulty: true, equipmentId: true },
      })
    ).map((e) => [e.id, e]),
  );
  const swaps = new Map<string, { exerciseId: string; replaces: string; repMin: number; repMax: number; noteSuffix: string }>();
  for (const [rowKey, exerciseId] of wanted) {
    const row = rows.get(rowKey);
    const sub = subs.get(exerciseId);
    if (!row || !sub) continue;
    const reps = adaptRepRange(
      { repMin: row.repMin, repMax: row.repMax },
      { originalDifficulty: row.exercise.difficulty, substituteDifficulty: sub.difficulty },
    );
    const noteSuffix =
      reps.shift === "harder"
        ? ` Variação mais difícil: ${row.sets}×${reps.repMin}, parando 1–2 antes da falha.`
        : reps.shift === "easier"
          ? ` Variação mais fácil: dá para fazer ${row.sets}×${reps.repMax}.`
          : "";
    swaps.set(rowKey, { exerciseId, replaces: row.exercise.namePt, repMin: reps.repMin, repMax: reps.repMax, noteSuffix });
  }

  await enforceProgramQuota(user.id);
  const program = await forkTemplateToProgram(template.slug, user.id, {
    swaps,
    name: `${template.namePt} (adaptado)`.slice(0, 120),
  });
  revalidatePath("/app/programs");
  redirect(`/app/programs/${program.id}/edit?adaptado=${swaps.size}`);
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
          name: true,
          sourceTemplateId: true,
          sourceTemplate: { select: { namePt: true } },
          createdAt: true,
          updatedAt: true,
          // Discarded starts (just above, or earlier) don't make it a trained program.
          _count: { select: { sessions: { where: { status: { not: "DISCARDED" } } } } },
        },
      });
      if (!program) continue;
      // The program row as the start read it — before the start itself rewrote updatedAt.
      const snapshot = (
        await tx.programEnrollment.findUnique({ where: { id: enrollment.id }, select: { programSnapshot: true } })
      )?.programSnapshot as { createdAt?: string; updatedAt?: string } | null;
      const started = enrollment.startedAt.getTime();
      const untouched = program._count.sessions === 0;
      // Forked by "Ativar" in the same request as the switch, and never edited since: a plain
      // copy of the template (not "(adaptado)" / "(cópia)" — those hold the user's choices),
      // never written between its insert and the start (a builder save rewrites updatedAt).
      const throwaway =
        untouched &&
        program.sourceTemplateId !== null &&
        program.name === program.sourceTemplate?.namePt &&
        !!snapshot?.createdAt &&
        snapshot.createdAt === snapshot.updatedAt &&
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
      // A-028 · a switched-to enrollment with no finished workout of its own is a
      // shadow: left ABANDONED it would hide the program's real stopped/finished
      // enrollment behind it (getProgramRestart reads the newest), so "Retomar da
      // semana N" or a finished block's "Começar GD N" would vanish on undo.
      // Remove it; its only sessions are discarded starts, which unlink via the
      // ON DELETE SET NULL on WorkoutSession.enrollmentId. The program above is
      // untouched by this and keeps its earlier enrollment.
      const ownFinished = await tx.workoutSession.count({
        where: { enrollmentId: enrollment.id, status: "COMPLETED", totalWorkingSets: { gt: 0 } },
      });
      if (ownFinished === 0) {
        await tx.programEnrollment.deleteMany({ where: { id: enrollment.id, userId: user.id } });
      }
    }
    // Scoped to the restored program's track: undoing a primary switch never
    // archives an active yoga / mobility plan running alongside it.
    await tx.userProgram.updateMany({
      where: { userId: user.id, status: "ACTIVE", id: { not: previous.programId }, ...goalFilterForTrack(trackOf(previous.program.goal)) },
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
    return { programId: previous.programId, isPrimary: trackOf(previous.program.goal) === "primary" };
  });
  // The profile's weekly frequency goes back with the program (the switch had
  // set the other one's) — only for the primary track, which owns the week.
  if (restored?.isPrimary) await applyWeekLayout(prisma, user.id, restored.programId);

  revalidatePath("/app/today");
  revalidatePath("/app/programs");
  redirect(restored ? "/app/today?retomado=1" : "/app/today");
}

export async function createCustomProgram(name: string) {
  const user = await requireUserOrThrow();
  await enforceProgramQuota(user.id);
  // Trained as often as the user said they train: a one-day full body is 3×/week, not 1×.
  const profile = await prisma.profile.findUnique({ where: { userId: user.id }, select: { daysPerWeek: true } });
  const program = await prisma.userProgram.create({
    data: {
      userId: user.id,
      // Trimmed and capped (A-003): a blank or ~1 MB name never reaches the row.
      name: normalizeProgramName(name),
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
  await enforceProgramQuota(user.id);

  const copy = await prisma.userProgram.create({
    data: {
      userId: user.id,
      name: `${original.name} (cópia)`.slice(0, 120),
      description: original.description,
      // Still "Baseado em GD 1" (its GD series place and test weeks come from it).
      sourceTemplateId: original.sourceTemplateId,
      sourceTemplateVersion: original.sourceTemplateVersion,
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
    select: { id: true },
  });
  revalidatePath("/app/programs");
  // Straight into the copy, saying so — the page used to stay on the original
  // with no sign anything happened, so people tapped again and again.
  redirect(`/app/programs/${copy.id}/edit?copia=1`);
}

/**
 * "Descartar rascunho" in the builder: a draft never trained is deleted, and
 * the user lands where they came from — the template it copied, or the
 * programs list. Anything else (running, trained, archived) is left alone.
 */
export async function discardDraft(programId: string) {
  const user = await requireUserOrThrow();
  if (typeof programId !== "string") redirect("/app/programs");
  const program = await prisma.userProgram.findFirst({
    where: { id: programId, userId: user.id },
    select: {
      status: true,
      sourceTemplate: { select: { slug: true } },
      _count: { select: { sessions: { where: { status: { not: "DISCARDED" } } } } },
    },
  });
  if (!program) redirect("/app/programs");
  if (program.status !== "DRAFT" || program._count.sessions > 0) redirect(`/app/programs/${programId}`);
  // Never one with a running enrollment, whatever its status says: a block
  // in progress must not lose its program. The checks above are repeated in
  // the delete itself, so a workout started meanwhile keeps it too.
  const deleted = await prisma.userProgram.deleteMany({
    where: {
      id: programId,
      userId: user.id,
      status: "DRAFT",
      enrollments: { none: { status: "ACTIVE" } },
      sessions: { none: { status: { not: "DISCARDED" } } },
    },
  });
  if (deleted.count === 0) redirect(`/app/programs/${programId}`);
  revalidatePath("/app/programs");
  redirect(
    program.sourceTemplate
      ? `/app/programs/templates/${program.sourceTemplate.slug}?descartado=1`
      : "/app/programs?excluido=1",
  );
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
    select: { status: true },
  });
  if (!program) redirect("/app/programs");
  // Bounded count on the (programId, status) index (A-037): a relation _count
  // here aggregates the whole WorkoutSession table.
  const trainedSessions = await prisma.workoutSession.count({
    where: { programId, status: { not: "DISCARDED" } },
  });
  if (program.status === "ACTIVE" || trainedSessions > 0) redirect(`/app/programs/${programId}`);
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
    select: { id: true, goal: true, days: { select: { _count: { select: { exercises: true } } } } },
  });
  if (!program) redirect("/app/programs");
  const restart = await getProgramRestart(user.id, programId);
  if (!restart.resumable || !program.days.some((d) => d._count.exercises > 0)) redirect(`/app/programs/${programId}`);
  const resumable = restart.resumable;
  const track = trackOf(program.goal);

  const outcome = await prisma.$transaction(async (tx) => {
    // Same per-user lock as startProgramInternal: no start/resume/open interleaves.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`;
    const previous = await tx.programEnrollment.findFirst({
      where: { userId: user.id, status: "ACTIVE", track },
      orderBy: { startedAt: "desc" },
      select: { id: true, programId: true },
    });
    // Already running this program (a double tap, a stale page): leave it be.
    if (previous?.programId === programId) return { resumed: false as const, previousId: null };
    await setAsOnlyActiveProgram(tx, user.id, programId, track);
    await tx.userProgram.update({ where: { id: programId }, data: { status: "ACTIVE", archivedAt: null } });
    await tx.programEnrollment.update({
      where: { id: resumable.enrollmentId },
      data: { status: "ACTIVE", endedAt: null, currentWeek: resumable.currentWeek },
    });
    // Only the primary track owns the user's week (see startProgramInternal).
    if (track === "primary") await applyWeekLayout(tx, user.id, programId);
    return { resumed: true as const, previousId: previous?.id ?? null };
  });

  revalidatePath("/app/programs");
  revalidatePath("/app/today");
  if (!outcome.resumed) redirect("/app/today");
  // Today says "<programa> retomado · semana N" (not "Programa ativado"), with the switch's undo when one ended.
  redirect(outcome.previousId ? `/app/today?retomado=1&anterior=${outcome.previousId}` : "/app/today?retomado=1");
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
  // A-027 · any enrollment started after this block ended — of any status —
  // means the user already moved on (the next block begun, even if since
  // stopped): don't start another copy from a stale hero/page.
  const startedSince = await prisma.programEnrollment.findFirst({
    where: { userId, id: { not: block.id }, startedAt: { gt: block.endedAt } },
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
