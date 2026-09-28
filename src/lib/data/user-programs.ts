import "server-only";
import { prisma } from "@/lib/db";
import { entryWeekWasTrained } from "@/lib/data/program-lifecycle";
import { programWeekNow } from "@/lib/programming/block-progress";
import { startOfWeek } from "@/lib/training/week";

export async function getUserProgram(id: string) {
  return prisma.userProgram.findUnique({
    where: { id },
    include: {
      days: {
        orderBy: { dayIndex: "asc" },
        include: {
          exercises: {
            orderBy: { sortOrder: "asc" },
            include: { exercise: { select: { id: true, namePt: true, slug: true, media: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true } } } } },
          },
        },
      },
      enrollments: { where: { status: "ACTIVE" }, take: 1 },
      sourceTemplate: { select: { namePt: true, slug: true } },
    },
  });
}

/**
 * Where an enrollment stands, as the switch and archive warnings and Today's
 * "Voltar para …" say it: "semana 3 de 13" — the week Today shows
 * (block-progress programWeekNow: a week with nothing done yet already reads
 * as the next one), so a short entry week (activated Thursday–Sunday) is
 * "semana de entrada" while it lasts and counts toward nothing (subtracted
 * only when trained); never past the duration.
 */
export async function getEnrollmentProgress(
  e: { id: string; userId: string; currentWeek: number; startedAt: Date; program: { durationWeeks: number | null } },
  now: Date = new Date(),
): Promise<string> {
  const weekStart = startOfWeek(now);
  const finished = { userId: e.userId, enrollmentId: e.id, status: "COMPLETED" as const, totalWorkingSets: { gt: 0 } };
  const [entryWeekTrained, sessionsThisWeek, before] = await Promise.all([
    entryWeekWasTrained(prisma, e),
    prisma.workoutSession.count({ where: { ...finished, finishedAt: { gte: weekStart, lte: now } } }),
    prisma.workoutSession.findFirst({ where: { ...finished, finishedAt: { lt: weekStart } }, select: { id: true } }),
  ]);
  const week = programWeekNow({
    currentWeek: e.currentWeek,
    startedAt: e.startedAt,
    entryWeekTrained,
    now,
    sessionsThisWeek,
    trainedBefore: before !== null,
  });
  if (week === 0) return "semana de entrada";
  const weeks = e.program.durationWeeks;
  return weeks ? `semana ${Math.min(week, weeks)} de ${weeks}` : `semana ${week}`;
}
