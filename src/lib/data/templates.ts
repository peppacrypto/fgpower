import "server-only";
import { prisma } from "@/lib/db";

export interface TemplateFilters {
  goal?: string;
  daysPerWeek?: number;
  experienceLevel?: string;
  equipmentAccess?: string;
}

export async function listTemplates(filters: TemplateFilters = {}) {
  return prisma.workoutTemplate.findMany({
    where: {
      isPublished: true,
      ...(filters.goal ? { goal: filters.goal as never } : {}),
      ...(filters.daysPerWeek ? { daysPerWeek: filters.daysPerWeek } : {}),
      ...(filters.experienceLevel ? { experienceLevel: filters.experienceLevel as never } : {}),
      ...(filters.equipmentAccess ? { equipmentAccess: filters.equipmentAccess as never } : {}),
    },
    orderBy: [{ isFlagship: "desc" }, { sortOrder: "asc" }],
    include: { days: { select: { id: true, namePt: true }, orderBy: { dayIndex: "asc" } } },
  });
}

export async function getTemplateBySlug(slug: string) {
  return prisma.workoutTemplate.findUnique({
    where: { slug },
    include: {
      days: {
        orderBy: { dayIndex: "asc" },
        include: {
          exercises: {
            orderBy: { sortOrder: "asc" },
            include: {
              exercise: {
                include: { equipment: true, media: { take: 1, orderBy: { sortOrder: "asc" } } },
              },
            },
          },
        },
      },
      evidence: { include: { source: true }, orderBy: { sortOrder: "asc" } },
      principles: { include: { principle: true }, orderBy: { sortOrder: "asc" } },
    },
  });
}
