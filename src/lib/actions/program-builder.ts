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

  const safeDays = builderDaysSchema.parse(days);

  await prisma.$transaction(async (tx) => {
    await tx.userProgramDay.deleteMany({ where: { programId } });
    for (let dayIndex = 0; dayIndex < safeDays.length; dayIndex++) {
      const day = safeDays[dayIndex];
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
      data: { daysPerWeek: safeDays.length || 1, status: program.status === "ARCHIVED" ? "DRAFT" : program.status },
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
