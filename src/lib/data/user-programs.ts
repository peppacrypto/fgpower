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
            include: { exercise: { select: { id: true, namePt: true, slug: true } } },
          },
        },
      },
      enrollments: { where: { status: "ACTIVE" }, take: 1 },
      sourceTemplate: { select: { namePt: true, slug: true } },
    },
  });
}
