"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { validateBuilderProgram, type BuilderFieldError } from "@/lib/validation/program-builder";

export interface BuilderExercise {
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
    }
  | { ok: false; errors: BuilderFieldError[]; message: string | null };

/**
 * Saves the whole program — name, description and the day/exercise
 * structure — in one transaction, so a failed save never leaves a half-saved
 * program (the rename used to commit before the days failed). Never throws
 * for bad input: invalid values come back as `errors` pinned to their field,
 * and the editor keeps its state. Days keep their ids; past logged workouts
 * reference their own immutable snapshot data, so replacing the structure
 * never rewrites history (spec §43.10).
 */
export async function saveProgram(
  programId: string,
  input: { name: string; description: string; days: BuilderDay[] },
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
  const { name, description, days: safeDays } = parsed.data;

  let dayIds: string[];
  try {
    dayIds = await prisma.$transaction(async (tx) => {
      const oldDays = await tx.userProgramDay.findMany({
        where: { programId },
        select: { id: true, dayIndex: true, name: true },
      });
      const oldIds = new Set(oldDays.map((d) => d.id));

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
      const daysPerWeek = repeatsDays
        ? Math.max(program.daysPerWeek, template?.daysPerWeek ?? 0, safeDays.length)
        : safeDays.length || 1;

      // Days are updated in place (same id) instead of deleted and recreated, so
      // workouts stay linked to their day: "feito esta semana", the in-progress
      // day and the next suggested day survive edits and reordering. Park the
      // current rows outside the (programId, dayIndex) unique range first.
      await tx.userProgramDay.updateMany({ where: { programId }, data: { dayIndex: { increment: 1000 } } });
      const newIdByOldId = new Map<string, string>();
      const finalDays: { id: string; name: string }[] = [];
      for (let dayIndex = 0; dayIndex < safeDays.length; dayIndex++) {
        const day = safeDays[dayIndex];
        const dayName = day.name.trim() || `Dia ${dayIndex + 1}`;
        const exercises = {
          create: day.exercises.map((ex, sortOrder) => ({
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
          })),
        };
        if (day.id && oldIds.has(day.id) && !newIdByOldId.has(day.id)) {
          await tx.userProgramExercise.deleteMany({ where: { dayId: day.id } });
          await tx.userProgramDay.update({
            where: { id: day.id },
            data: { dayIndex, name: dayName, focus: day.focus, exercises },
          });
          newIdByOldId.set(day.id, day.id);
          finalDays.push({ id: day.id, name: dayName });
        } else {
          const created = await tx.userProgramDay.create({
            data: { programId, dayIndex, name: dayName, focus: day.focus, exercises },
            select: { id: true },
          });
          finalDays.push({ id: created.id, name: dayName });
        }
      }
      // Removed days (still parked) go now.
      await tx.userProgramDay.deleteMany({ where: { programId, dayIndex: { gte: 1000 } } });

      // Keep each active enrollment's "next day" on the same day it pointed at.
      const enrollments = await tx.programEnrollment.findMany({
        where: { programId, status: "ACTIVE" },
        select: { id: true, nextDayIndex: true },
      });
      for (const e of enrollments) {
        const pointed = oldDays.find((d) => d.dayIndex === e.nextDayIndex);
        let next = pointed ? finalDays.findIndex((d) => d.id === pointed.id) : -1;
        if (next < 0 && pointed) {
          const byName = finalDays.flatMap((d, i) => (d.name === pointed.name ? [i] : []));
          if (byName.length === 1) next = byName[0];
        }
        if (next < 0) next = Math.min(e.nextDayIndex, Math.max(0, finalDays.length - 1));
        if (next !== e.nextDayIndex) {
          await tx.programEnrollment.update({ where: { id: e.id }, data: { nextDayIndex: next } });
        }
      }

      await tx.userProgram.update({
        where: { id: programId },
        data: {
          name,
          description: description || null,
          daysPerWeek,
          status: program.status === "ARCHIVED" ? "DRAFT" : program.status,
        },
      });
      return finalDays.map((d) => d.id);
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
  return { ok: true, name, description, dayIds };
}
