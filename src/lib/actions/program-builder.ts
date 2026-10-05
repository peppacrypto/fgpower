"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { validateBuilderProgram, type BuilderFieldError } from "@/lib/validation/program-builder";
import { applyWeekLayout, entryWeekWasTrained } from "@/lib/data/program-lifecycle";
import { countedWeeks } from "@/lib/programming/block-progress";
import { normalizeGroupKeys } from "@/lib/programming/groups";
import type { ProgressionStrategy } from "@/lib/training/progression";
import type { Prisma } from "@/generated/prisma/client";

export interface BuilderExercise {
  /**
   * The saved row's id (UserProgramExercise). A save updates that row in
   * place, so logged workouts stay linked to it (WorkoutExerciseLog.
   * programExerciseId) and fields the builder doesn't edit survive. New and
   * duplicated rows have none until saved.
   */
  id?: string;
  exerciseId: string;
  /** Display only, not persisted — optional so callers can omit it before saving. */
  exerciseName?: string;
  groupKey: string | null;
  sets: number;
  repMin: number;
  repMax: number;
  rirTarget: number | null;
  restSeconds: number;
  warmupSets: number;
  loadTargetKg: number | null;
  notes: string | null;
  // Carried, not edited: shown nowhere in the builder, only copied onto a new
  // row (a duplicate keeps its source's). A save never writes them onto an
  // existing row, which keeps its own.
  rpeTarget?: number | null;
  tempo?: string | null;
  progressionStrategy?: ProgressionStrategy | null;
  loadIncrementKg?: number | null;
}

export interface BuilderDay {
  /** The existing day's id, so edits keep the day (and its workouts) linked. */
  id?: string;
  name: string;
  focus: string | null;
  exercises: BuilderExercise[];
}

export type SaveProgramResult =
  | {
      ok: true;
      /** What was stored (trimmed), so the editor shows the persisted values. */
      name: string;
      description: string;
      /** Final day ids in order — new days get theirs here, so a second save keeps them. */
      dayIds: string[];
      /** Final exercise row ids, per day and in order (new rows get theirs here too). */
      exerciseIds: string[][];
      /** The weekly frequency and duration stored. */
      daysPerWeek: number;
      durationWeeks: number | null;
      /**
       * A-024 · the duration edit ended the running block (it is now a stopped,
       * resumable program in "Arquivados"). The builder shows the archived
       * state and the fact it can be resumed.
       */
      blockEnded: boolean;
    }
  | { ok: false; errors: BuilderFieldError[]; message: string | null };

/** The exercise columns the builder edits — the only ones a save writes on an existing row. */
const EDITED_SELECT = {
  dayId: true,
  exerciseId: true,
  sortOrder: true,
  groupKey: true,
  sets: true,
  repMin: true,
  repMax: true,
  rirTarget: true,
  restSeconds: true,
  warmupSets: true,
  loadTargetKg: true,
  notes: true,
} as const satisfies Prisma.UserProgramExerciseSelect;
type EditedRow = Prisma.UserProgramExerciseGetPayload<{ select: typeof EDITED_SELECT }>;
const EDITED_FIELDS = Object.keys(EDITED_SELECT) as (keyof EditedRow)[];

/**
 * Saves the whole program — name, description and the day/exercise
 * structure — in one transaction, so a failed save never leaves a half-saved
 * program (the rename used to commit before the days failed). Never throws
 * for bad input: invalid values come back as `errors` pinned to their field,
 * and the editor keeps its state. Days and exercise rows keep their ids: rows
 * are updated in place (only when something changed), new ones created and
 * removed ones deleted — never all deleted and recreated, which unlinked
 * every logged workout from its row and dropped the fields the builder
 * doesn't edit (tempo, RPE, progression). Past logged workouts reference
 * their own immutable snapshot data, so changing the structure never
 * rewrites history (spec §43.10).
 */
export async function saveProgram(
  programId: string,
  input: {
    name: string;
    description: string;
    days: BuilderDay[];
    /** "Treinos por semana" (≥ the number of days). Absent: inferred from the days, as before. */
    daysPerWeek?: number;
    /** "Duração (semanas, opcional)": null clears it; absent leaves it. */
    durationWeeks?: number | null;
    /**
     * A-024 · the builder confirmed "Isso encerra o bloco agora": a shrink of
     * "Duração" at/under the weeks already trained ends the running block.
     * Without it, such a shrink is ignored (the stored duration is unchanged)
     * so a running block is never silently completed.
     */
    confirmShortenDuration?: boolean;
  },
): Promise<SaveProgramResult> {
  const session = await getCurrentSession();
  if (!session) {
    return { ok: false, errors: [], message: "Sua sessão expirou. Entre de novo — as alterações ficam guardadas neste aparelho." };
  }
  const program = await prisma.userProgram.findUnique({ where: { id: String(programId) } });
  if (!program || program.userId !== session.user.id) {
    return { ok: false, errors: [], message: "Programa não encontrado." };
  }

  const parsed = validateBuilderProgram(input);
  if (!parsed.ok) return { ok: false, errors: parsed.errors, message: null };
  const { name, description } = parsed.data;
  // Supersets are stored canonical (W-104): each group's letter, a lone or
  // stray key cleared — bad keys are fixed, never rejected.
  const safeDays = parsed.data.days.map((d) => ({ ...d, exercises: normalizeGroupKeys(d.exercises) }));
  const durationWeeks = parsed.data.durationWeeks === undefined ? program.durationWeeks : parsed.data.durationWeeks;
  const confirmShortenDuration = input.confirmShortenDuration === true;

  let saved: { dayIds: string[]; exerciseIds: string[][]; daysPerWeek: number; durationWeeks: number | null; blockEnded: boolean };
  try {
    saved = await prisma.$transaction(async (tx) => {
      const oldDays = await tx.userProgramDay.findMany({
        where: { programId },
        select: { id: true, dayIndex: true, name: true },
      });
      const oldIds = new Set(oldDays.map((d) => d.id));
      // Every exercise row of this program — an id from the payload counts
      // only if it is one of these (never another program's row).
      const oldRows = await tx.userProgramExercise.findMany({
        where: { day: { programId } },
        select: { id: true, ...EDITED_SELECT },
      });
      const oldRowById = new Map(oldRows.map((r) => [r.id, r]));
      const keptRowIds = new Set<string>();

      // A plan that repeats its days within the week (A/B at 3×) keeps its
      // frequency; otherwise the frequency follows the number of days.
      const template = program.sourceTemplateId
        ? await tx.workoutTemplate.findUnique({
            where: { id: program.sourceTemplateId },
            select: { daysPerWeek: true, _count: { select: { days: true } } },
          })
        : null;
      const repeatsDays =
        (oldDays.length > 0 && program.daysPerWeek > oldDays.length) ||
        (!!template && template.daysPerWeek > template._count.days);
      // The editor sends its "Treinos por semana"; without it (an older editor), infer as before.
      const daysPerWeek =
        parsed.data.daysPerWeek !== undefined
          ? Math.max(parsed.data.daysPerWeek, safeDays.length || 1)
          : repeatsDays
            ? Math.max(program.daysPerWeek, template?.daysPerWeek ?? 0, safeDays.length)
            : safeDays.length || 1;

      // Days are updated in place (same id) instead of deleted and recreated, so
      // workouts stay linked to their day: "feito esta semana", the in-progress
      // day and the next suggested day survive edits and reordering. Park the
      // current rows outside the (programId, dayIndex) unique range first.
      await tx.userProgramDay.updateMany({ where: { programId }, data: { dayIndex: { increment: 1000 } } });
      const newIdByOldId = new Map<string, string>();
      const finalDays: { id: string; name: string; exerciseIds: string[] }[] = [];
      for (let dayIndex = 0; dayIndex < safeDays.length; dayIndex++) {
        const day = safeDays[dayIndex];
        const dayName = day.name.trim() || `Dia ${dayIndex + 1}`;
        let dayId: string;
        if (day.id && oldIds.has(day.id) && !newIdByOldId.has(day.id)) {
          await tx.userProgramDay.update({ where: { id: day.id }, data: { dayIndex, name: dayName, focus: day.focus } });
          newIdByOldId.set(day.id, day.id);
          dayId = day.id;
        } else {
          const created = await tx.userProgramDay.create({
            data: { programId, dayIndex, name: dayName, focus: day.focus },
            select: { id: true },
          });
          dayId = created.id;
        }

        const exerciseIds: string[] = [];
        for (let sortOrder = 0; sortOrder < day.exercises.length; sortOrder++) {
          const ex = day.exercises[sortOrder];
          const edited: EditedRow = {
            dayId,
            exerciseId: ex.exerciseId,
            sortOrder,
            groupKey: ex.groupKey,
            sets: ex.sets,
            repMin: ex.repMin,
            repMax: ex.repMax,
            rirTarget: ex.rirTarget,
            restSeconds: ex.restSeconds,
            warmupSets: ex.warmupSets,
            loadTargetKg: ex.loadTargetKg,
            notes: ex.notes,
          };
          // The first row claiming an id keeps it; a second one (a stale
          // duplicate) becomes a new row.
          const old = ex.id && !keptRowIds.has(ex.id) ? oldRowById.get(ex.id) : undefined;
          if (old) {
            keptRowIds.add(old.id);
            if (EDITED_FIELDS.some((f) => old[f] !== edited[f])) {
              await tx.userProgramExercise.update({ where: { id: old.id }, data: edited });
            }
            exerciseIds.push(old.id);
          } else {
            const created = await tx.userProgramExercise.create({
              data: {
                ...edited,
                rpeTarget: ex.rpeTarget ?? null,
                tempo: ex.tempo ?? null,
                progressionStrategy: ex.progressionStrategy ?? null,
                loadIncrementKg: ex.loadIncrementKg ?? null,
              },
              select: { id: true },
            });
            exerciseIds.push(created.id);
          }
        }
        finalDays.push({ id: dayId, name: dayName, exerciseIds });
      }
      // Rows no longer in the program go (their logged workouts keep their
      // own snapshot), then removed days, still parked.
      const removedRowIds = oldRows.filter((r) => !keptRowIds.has(r.id)).map((r) => r.id);
      if (removedRowIds.length) await tx.userProgramExercise.deleteMany({ where: { id: { in: removedRowIds } } });
      // Removed days (still parked) go now.
      await tx.userProgramDay.deleteMany({ where: { programId, dayIndex: { gte: 1000 } } });

      // Keep each running OR STOPPED enrollment's "next day" on the same day it
      // pointed at, and its planned total on the new frequency/duration. A
      // stopped (ABANDONED) block is remapped too: editing it before "Retomar"
      // (e.g. deleting a day) must not leave the resumed block pointing at the
      // wrong next day — nextDayIndex is a dayIndex into days the edit just
      // renumbered (A-062). COMPLETED blocks are left alone ("Repetir bloco"
      // starts over).
      const enrollments = await tx.programEnrollment.findMany({
        where: { programId, status: { in: ["ACTIVE", "ABANDONED"] } },
        select: { id: true, nextDayIndex: true, plannedSessions: true, status: true, currentWeek: true, startedAt: true },
      });

      // A-024 · a "Duração" edit that drops a running block at/under the weeks
      // already trained ends it — but only when the builder confirmed, and as a
      // STOPPED (resumable) block, never a false PROGRAM_COMPLETED for a block
      // that was never finished. An unconfirmed shrink is ignored (the old
      // duration is kept). Raising the duration again just lets it continue. The
      // running block is the one ACTIVE enrollment (never an ABANDONED row that
      // the broadened query above also returns).
      const running = program.status === "ACTIVE" ? enrollments.find((e) => e.status === "ACTIVE") : undefined;
      let effectiveDuration = durationWeeks;
      let blockEnded = false;
      if (running && durationWeeks != null) {
        const trained = countedWeeks(
          running.currentWeek,
          running.startedAt,
          await entryWeekWasTrained(tx, { id: running.id, userId: session.user.id, startedAt: running.startedAt }),
        );
        if (durationWeeks <= trained) {
          if (confirmShortenDuration) blockEnded = true;
          else effectiveDuration = program.durationWeeks;
        }
      }

      // The planned total follows the (possibly clamped) duration, remapped onto
      // every running/stopped enrollment alongside its next-day pointer (A-062 + A-024).
      const plannedSessions = effectiveDuration ? effectiveDuration * daysPerWeek : null;
      for (const e of enrollments) {
        const pointed = oldDays.find((d) => d.dayIndex === e.nextDayIndex);
        let next = pointed ? finalDays.findIndex((d) => d.id === pointed.id) : -1;
        if (next < 0 && pointed) {
          const byName = finalDays.flatMap((d, i) => (d.name === pointed.name ? [i] : []));
          if (byName.length === 1) next = byName[0];
        }
        if (next < 0) next = Math.min(e.nextDayIndex, Math.max(0, finalDays.length - 1));
        const data: Prisma.ProgramEnrollmentUpdateInput = {};
        if (next !== e.nextDayIndex) data.nextDayIndex = next;
        if (plannedSessions !== e.plannedSessions) data.plannedSessions = plannedSessions;
        if (Object.keys(data).length > 0) await tx.programEnrollment.update({ where: { id: e.id }, data });
      }

      await tx.userProgram.update({
        where: { id: programId },
        data: {
          name,
          description: description || null,
          daysPerWeek,
          durationWeeks: effectiveDuration,
          // A confirmed shrink ends the running block: the program joins
          // "Arquivados". Otherwise an archived program edited back to a draft,
          // every other status unchanged.
          status: blockEnded ? "ARCHIVED" : program.status === "ARCHIVED" ? "DRAFT" : program.status,
          archivedAt: blockEnded ? new Date() : undefined,
        },
      });
      if (blockEnded && running) {
        // Ended as a STOPPED block: resumable from where it was, flagged so the
        // re-entry surfaces say why. Empty open starts of it are discarded, as
        // on archive (a started-but-logged workout stays so it can be finished —
        // finishing it advances this abandoned block, A-026).
        await tx.programEnrollment.update({
          where: { id: running.id },
          data: { status: "ABANDONED", endedAt: new Date(), endedByDurationEdit: true },
        });
        await tx.workoutSession.updateMany({
          where: {
            userId: session.user.id,
            programId,
            status: "IN_PROGRESS",
            setLogs: { none: { OR: [{ isCompleted: true }, { weightKg: { not: null } }, { reps: { not: null } }] } },
          },
          data: { status: "DISCARDED" },
        });
      } else if (program.status === "ACTIVE") {
        // The running block's days follow the new layout on the user's week.
        await applyWeekLayout(tx, session.user.id, programId);
      }
      return {
        dayIds: finalDays.map((d) => d.id),
        exerciseIds: finalDays.map((d) => d.exerciseIds),
        daysPerWeek,
        durationWeeks: effectiveDuration,
        blockEnded,
      };
    });
  } catch (err) {
    // e.g. an exercise removed from the catalog meanwhile (FK) or a lost
    // connection: nothing was written, and the editor keeps every change.
    console.error("saveProgram failed", err);
    return { ok: false, errors: [], message: "Não foi possível salvar agora. Suas alterações continuam aqui — tente de novo." };
  }

  revalidatePath(`/app/programs/${programId}`);
  revalidatePath(`/app/programs/${programId}/edit`);
  revalidatePath("/app/programs");
  revalidatePath("/app/today");
  return { ok: true, name, description, ...saved };
}
