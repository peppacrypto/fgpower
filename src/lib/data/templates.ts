import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import type { CatalogItem } from "@/lib/programming/catalog";
import type { RecommendProfile } from "@/lib/programming/recommend";

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
    include: {
      days: {
        select: {
          id: true,
          namePt: true,
          // What the plan really needs (the recommender's runnable check, L-home-catalog-gap).
          exercises: { select: { exercise: { select: { equipmentId: true } } } },
        },
        orderBy: { dayIndex: "asc" },
      },
    },
  });
}

export type ListedTemplate = Awaited<ReturnType<typeof listTemplates>>[number];

/** The fields the library, cards and recommender read. */
export function toCatalogItem(
  t: Omit<ListedTemplate, "days"> & { days: { namePt: string; exercises?: { exercise: { equipmentId: string | null } }[] }[] },
): CatalogItem & { isFlagship: boolean } {
  const equipment = t.days.every((d) => d.exercises)
    ? [...new Set(t.days.flatMap((d) => (d.exercises ?? []).map((e) => e.exercise.equipmentId).filter((id): id is string => !!id)))]
    : undefined;
  return {
    slug: t.slug,
    namePt: t.namePt,
    taglinePt: t.taglinePt,
    goal: t.goal,
    experienceLevel: t.experienceLevel,
    trainingStyle: t.trainingStyle,
    equipmentAccess: t.equipmentAccess,
    daysPerWeek: t.daysPerWeek,
    durationWeeks: t.durationWeeks,
    sessionMinutes: t.sessionMinutes,
    dayNames: t.days.map((d) => d.namePt),
    equipmentIds: equipment,
    isFlagship: t.isFlagship,
  };
}

/** A user's onboarding answers as the recommender reads them (null = no profile yet). */
export function recommendProfileOf(
  profile: {
    goal: string;
    experience: string;
    daysPerWeek: number;
    sessionMinutes: number;
    equipmentAccess: string;
    doesEndurance: boolean;
    onboardingCompletedAt: Date | null;
  } | null,
): RecommendProfile | null {
  if (!profile?.onboardingCompletedAt) return null;
  return {
    goal: profile.goal,
    experience: profile.experience,
    daysPerWeek: profile.daysPerWeek,
    sessionMinutes: profile.sessionMinutes,
    equipmentAccess: profile.equipmentAccess,
    doesEndurance: profile.doesEndurance,
  };
}

/** Published templates built on a training principle, in catalog order. */
export async function listTemplatesUsingPrinciple(principleId: string) {
  return prisma.workoutTemplate.findMany({
    where: { isPublished: true, principles: { some: { principleId } } },
    orderBy: [{ isFlagship: "desc" }, { sortOrder: "asc" }],
    include: {
      days: {
        select: { id: true, namePt: true, exercises: { select: { exercise: { select: { equipmentId: true } } } } },
        orderBy: { dayIndex: "asc" },
      },
    },
  });
}

/** The GD series' published blocks (the rail on each block's dossier), in any order. */
export async function listSeriesTemplates(slugs: readonly string[]) {
  return prisma.workoutTemplate.findMany({
    where: { isPublished: true, slug: { in: [...slugs] } },
    select: { slug: true, namePt: true, durationWeeks: true, experienceLevel: true },
  });
}

export const getTemplateBySlug = cache(async (slug: string) => {
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
});
