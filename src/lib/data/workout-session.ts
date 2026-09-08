import "server-only";
import { prisma } from "@/lib/db";

export async function getWorkoutSessionForExecution(sessionId: string) {
  return prisma.workoutSession.findUnique({
    where: { id: sessionId },
    include: {
      exerciseLogs: {
        orderBy: { sortOrder: "asc" },
        include: {
          exercise: {
            include: { media: { take: 1, orderBy: { sortOrder: "asc" } } },
          },
          sets: { orderBy: { setNumber: "asc" } },
        },
      },
    },
  });
}

/** The user's most recent COMPLETED performance for an exercise, excluding the current session. */
export async function getPreviousPerformance(userId: string, exerciseId: string, excludeSessionId: string) {
  const lastLog = await prisma.workoutExerciseLog.findFirst({
    where: {
      userId,
      exerciseId,
      sessionId: { not: excludeSessionId },
      session: { status: "COMPLETED" },
    },
    orderBy: { createdAt: "desc" },
    include: { sets: { where: { isCompleted: true, setType: "WORKING" }, orderBy: { setNumber: "asc" } } },
  });
  return lastLog?.sets ?? [];
}

export async function getExerciseUserNote(userId: string, exerciseId: string) {
  return prisma.exerciseUserNote.findUnique({ where: { userId_exerciseId: { userId, exerciseId } } });
}
