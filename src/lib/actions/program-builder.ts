"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";

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
  name: string;
  focus: string | null;
  exercises: BuilderExercise[];
}

/** Bulk-replaces a program's entire day/exercise structure. Past logged
 * workouts reference their own immutable snapshot data, so replacing the
 * structure never rewrites history (spec §43.10). */
export async function saveProgramDays(programId: string, days: BuilderDay[]) {
  const user = await requireUserOrThrow();
  const program = await prisma.userProgram.findUniqueOrThrow({ where: { id: programId } });
  if (program.userId !== user.id) throw new Error("FORBIDDEN");

  await prisma.$transaction(async (tx) => {
    await tx.userProgramDay.deleteMany({ where: { programId } });
    for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
      const day = days[dayIndex];
      await tx.userProgramDay.create({
        data: {
          programId,
          dayIndex,
          name: day.name || `Dia ${dayIndex + 1}`,
          focus: day.focus,
          exercises: {
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
          },
        },
      });
    }
    await tx.userProgram.update({
      where: { id: programId },
      data: { daysPerWeek: days.length || 1, status: program.status === "ARCHIVED" ? "DRAFT" : program.status },
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
