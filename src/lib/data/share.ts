import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { PUBLIC_USER_SELECT, toPublicUser } from "@/lib/data/social/public-user";
import { isShareToken } from "@/lib/social/share-token";
import { toPublicWorkoutView } from "@/lib/social/public-workout";

/**
 * A workout opened through its share link (/t/<token>): only what anyone
 * holding the link may see — the stored card (sanitized again, see
 * public-workout.ts), the caption, the author's public identity and the
 * workout's number. Never the notes, the check-in, body data or anything
 * else of the author's. Null for a malformed or revoked token, a moderated
 * post, a banned author, or anything that isn't a finished workout.
 * Cached per request: the page, its metadata and its images share one read.
 */
export const getSharedWorkout = cache(async (token: string) => {
  if (!isShareToken(token)) return null;
  const activity = await prisma.activity.findUnique({
    where: { shareToken: token },
    select: {
      id: true,
      userId: true,
      sessionId: true,
      type: true,
      caption: true,
      visibility: true,
      showDetailedLoads: true,
      summary: true,
      fgCount: true,
      moderatedAt: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: { ...PUBLIC_USER_SELECT, banned: true, profile: { select: { displayName: true, isPublicAccount: true } } },
      },
      session: { select: { status: true, finishedAt: true, durationSeconds: true } },
    },
  });
  if (
    !activity ||
    activity.type !== "WORKOUT" ||
    activity.moderatedAt ||
    activity.user.banned === true ||
    !activity.sessionId ||
    activity.session?.status !== "COMPLETED" ||
    !activity.session.finishedAt
  ) {
    return null;
  }
  const finishedAt = activity.session.finishedAt;
  // "Treino nº 42": the author's finished workouts up to and including this one.
  const ordinal = await prisma.workoutSession.count({
    where: { userId: activity.userId, status: "COMPLETED", finishedAt: { lte: finishedAt } },
  });
  return {
    activity: {
      id: activity.id,
      userId: activity.userId,
      sessionId: activity.sessionId,
      caption: activity.caption?.trim() || null,
      visibility: activity.visibility,
      showDetailedLoads: activity.showDetailedLoads,
      fgCount: activity.fgCount,
      /** Versions the story image (a caption or loads change re-renders it). */
      updatedAt: activity.updatedAt,
    },
    author: toPublicUser(activity.user),
    authorIsPublic: activity.user.profile?.isPublicAccount ?? false,
    view: toPublicWorkoutView(activity.summary, activity.showDetailedLoads),
    finishedAt,
    durationSeconds: activity.session.durationSeconds,
    ordinal,
  };
});

export type SharedWorkout = NonNullable<Awaited<ReturnType<typeof getSharedWorkout>>>;
