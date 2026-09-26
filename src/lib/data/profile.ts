import "server-only";
import { prisma } from "@/lib/db";

export async function getProfile(userId: string) {
  return prisma.profile.findUnique({ where: { userId } });
}

export async function hasCompletedOnboarding(userId: string) {
  const profile = await getProfile(userId);
  return Boolean(profile?.onboardingCompletedAt);
}

/**
 * The user's public handle, read from the DB. Don't use the session user for
 * this: better-auth's session cookie cache can serve a handle up to 5 minutes
 * old, so a just-claimed username would look unsaved.
 */
export async function getPublicHandle(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true, displayUsername: true },
  });
  return user?.displayUsername ?? user?.username ?? null;
}
