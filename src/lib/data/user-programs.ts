import "server-only";
import { prisma } from "@/lib/db";

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

/** Where an enrollment stands, as the switch warning says it: "semana 3 de 13". */
export function enrollmentProgress(e: { currentWeek: number; program: { durationWeeks: number | null } }) {
  return e.program.durationWeeks ? `semana ${e.currentWeek} de ${e.program.durationWeeks}` : `semana ${e.currentWeek}`;
}
