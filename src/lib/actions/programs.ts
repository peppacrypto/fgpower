"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { getTemplateBySlug } from "@/lib/data/templates";

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
}

export async function startTemplate(templateSlug: string) {
  const user = await requireUserOrThrow();
  const program = await forkTemplateToProgram(templateSlug, user.id);
  await startProgramInternal(user.id, program.id);
  redirect("/app/today");
}

export async function customizeTemplate(templateSlug: string) {
  const user = await requireUserOrThrow();
  const program = await forkTemplateToProgram(templateSlug, user.id);
  redirect(`/app/programs/${program.id}/edit`);
}

async function startProgramInternal(userId: string, programId: string) {
  const program = await prisma.userProgram.findUniqueOrThrow({
    where: { id: programId },
    include: { days: { include: { exercises: true }, orderBy: { dayIndex: "asc" } } },
  });
  if (program.userId !== userId) throw new Error("FORBIDDEN");

  await setAsOnlyActiveProgram(userId, programId);

  await prisma.userProgram.update({ where: { id: programId }, data: { status: "ACTIVE" } });

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
}

export async function startProgram(programId: string) {
  const user = await requireUserOrThrow();
  await startProgramInternal(user.id, programId);
  redirect("/app/today");
}

export async function createCustomProgram(name: string) {
  const user = await requireUserOrThrow();
  const program = await prisma.userProgram.create({
    data: { userId: user.id, name: name || "Meu programa", status: "DRAFT" },
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

export async function archiveProgram(programId: string) {
  const user = await requireUserOrThrow();
  const program = await prisma.userProgram.findUniqueOrThrow({ where: { id: programId } });
  if (program.userId !== user.id) throw new Error("FORBIDDEN");

  await prisma.userProgram.update({
    where: { id: programId },
    data: { status: "ARCHIVED", archivedAt: new Date() },
  });
  await prisma.programEnrollment.updateMany({
    where: { programId, status: "ACTIVE" },
    data: { status: "ABANDONED", endedAt: new Date() },
  });
  revalidatePath("/app/programs");
  revalidatePath("/app/today");
}
