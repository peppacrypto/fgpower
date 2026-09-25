"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";

// Server actions are just client-controlled HTTP POSTs — the TypeScript `number`
// type is NOT enforced at runtime. Without these caps an authenticated user can
// persist e.g. warmupSets: 2e9, which later blows up Array.from(...) and OOM-kills
// the whole Node process. Clamp sizes and numeric ranges before any write.
const builderExerciseSchema = z.object({
  exerciseId: z.string().min(1).max(64),
  exerciseName: z.string().max(200).optional(),
  groupKey: z.string().max(24).nullable(),
  sets: z.coerce.number().int().min(1).max(30),
  repMin: z.coerce.number().int().min(1).max(100),
  repMax: z.coerce.number().int().min(1).max(100),
  rirTarget: z.coerce.number().min(0).max(10).nullable(),
  restSeconds: z.coerce.number().int().min(0).max(3600),
  warmupSets: z.coerce.number().int().min(0).max(15),
  loadTargetKg: z.coerce.number().min(0).max(2000).nullable(),
  notes: z.string().max(2000).nullable(),
});
const builderDaysSchema = z
  .array(
    z.object({
      id: z.string().max(64).optional(),
      name: z.string().max(120),
      focus: z.string().max(200).nullable(),
      exercises: z.array(builderExerciseSchema).max(40),
    }),
  )
  .max(14);

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

/** Saves a program's day/exercise structure (days keep their ids). Past logged
 * workouts reference their own immutable snapshot data, so replacing the
 * structure never rewrites history (spec §43.10). */
export async function saveProgramDays(programId: string, days: BuilderDay[]) {
  const user = await requireUserOrThrow();
  const program = await prisma.userProgram.findUniqueOrThrow({ where: { id: programId } });
  if (program.userId !== user.id) throw new Error("FORBIDDEN");

  const safeDays = builderDaysSchema.parse(days);

  await prisma.$transaction(async (tx) => {
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
      const name = day.name || `Dia ${dayIndex + 1}`;
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
          data: { dayIndex, name, focus: day.focus, exercises },
        });
        newIdByOldId.set(day.id, day.id);
        finalDays.push({ id: day.id, name });
      } else {
        const created = await tx.userProgramDay.create({
          data: { programId, dayIndex, name, focus: day.focus, exercises },
          select: { id: true },
        });
        finalDays.push({ id: created.id, name });
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
      data: { daysPerWeek, status: program.status === "ARCHIVED" ? "DRAFT" : program.status },
    });
  });

  revalidatePath(`/app/programs/${programId}`);
  revalidatePath(`/app/programs/${programId}/edit`);
}

export async function renameProgram(programId: string, name: string, description: string) {
  const user = await requireUserOrThrow();
  const program = await prisma.userProgram.findUniqueOrThrow({ where: { id: programId } });
  if (program.userId !== user.id) throw new Error("FORBIDDEN");
  await prisma.userProgram.update({
    where: { id: programId },
    data: { name: name.trim() || program.name, description: description.trim() || null },
  });
  revalidatePath(`/app/programs/${programId}`);
}
