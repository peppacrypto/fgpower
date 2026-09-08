import "server-only";
import { prisma } from "@/lib/db";

export async function getActiveEnrollment(userId: string) {
  return prisma.programEnrollment.findFirst({
    where: { userId, status: "ACTIVE" },
    include: {
      program: {
        include: {
          days: {
            orderBy: { dayIndex: "asc" },
            include: {
              exercises: {
                orderBy: { sortOrder: "asc" },
                include: { exercise: { select: { id: true, namePt: true, slug: true } } },
              },
            },
          },
        },
      },
    },
    orderBy: { startedAt: "desc" },
  });
}

export async function getRecentSessions(userId: string, limit = 5) {
  return prisma.workoutSession.findMany({
    where: { userId, status: "COMPLETED" },
    orderBy: { finishedAt: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      finishedAt: true,
      durationSeconds: true,
      totalVolumeKg: true,
      totalWorkingSets: true,
    },
  });
}

export async function getWeeklyProgress(userId: string) {
  const startOfWeek = new Date();
  const day = startOfWeek.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // ISO week: Monday start
  startOfWeek.setDate(startOfWeek.getDate() + diff);
  startOfWeek.setHours(0, 0, 0, 0);

  const count = await prisma.workoutSession.count({
    where: { userId, status: "COMPLETED", finishedAt: { gte: startOfWeek } },
  });
  return count;
}

export async function getRecentPersonalRecords(userId: string, limit = 3) {
  return prisma.exercisePersonalRecord.findMany({
    where: { userId },
    orderBy: { achievedAt: "desc" },
    take: limit,
    include: { exercise: { select: { namePt: true, slug: true } } },
  });
}

export async function getInProgressSession(userId: string) {
  return prisma.workoutSession.findFirst({
    where: { userId, status: "IN_PROGRESS" },
    orderBy: { startedAt: "desc" },
  });
}
