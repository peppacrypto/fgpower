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
              muscles: { where: { role: "PRIMARY" }, select: { muscle: { select: { group: true } } } },
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
      primaryMuscleGroups: ex.exercise.muscles.map((m) => m.muscle.group as never),
      movementPattern: ex.exercise.movementPattern?.id ?? null,
      sets: ex.sets,
    })),
  }));

  return analyzeProgram(ruleDays);
}
