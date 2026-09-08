import "server-only";
import { prisma } from "@/lib/db";

export async function getProfile(userId: string) {
  return prisma.profile.findUnique({ where: { userId } });
}

export async function hasCompletedOnboarding(userId: string) {
  const profile = await getProfile(userId);
  return Boolean(profile?.onboardingCompletedAt);
}
