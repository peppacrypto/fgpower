import "server-only";
import { prisma } from "@/lib/db";
import { analyzeProgram, type ProgramRuleDay } from "./rules";

export async function analyzeUserProgram(programId: string) {
  const days = await prisma.userProgramDay.findMany({
    where: { programId },
    orderBy: { dayIndex: "asc" },
    include: {
      exercises: {
        include: {
          exercise: {
            select: {
              nameEn: true,
              namePt: true,
              movementPattern: { select: { id: true } },
              muscles: { select: { role: true, muscle: { select: { id: true, nameEn: true, namePt: true, group: true } } } },
            },
          },
        },
      },
    },
  });

  const ruleDays: ProgramRuleDay[] = days.map((day) => ({
    dayIndex: day.dayIndex,
    nameEn: day.name,
    namePt: day.name,
    exercises: day.exercises.map((ex) => ({
      exerciseId: ex.exerciseId,
      nameEn: ex.exercise.nameEn,
      namePt: ex.exercise.namePt,
      primaryMuscleGroups: ex.exercise.muscles.filter((m) => m.role === "PRIMARY").map((m) => m.muscle.group as never),
      primaryMuscles: ex.exercise.muscles
        .filter((m) => m.role === "PRIMARY")
        .map(({ muscle }) => ({ id: muscle.id, nameEn: muscle.nameEn, namePt: muscle.namePt })),
      secondaryMuscles: ex.exercise.muscles
        .filter((m) => m.role === "SECONDARY")
        .map(({ muscle }) => ({ id: muscle.id, nameEn: muscle.nameEn, namePt: muscle.namePt })),
      movementPattern: ex.exercise.movementPattern?.id ?? null,
      sets: ex.sets,
    })),
  }));

  return analyzeProgram(ruleDays);
}
