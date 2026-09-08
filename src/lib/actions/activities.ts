"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { buildWorkoutActivitySummary } from "@/lib/social/activity-summary";

export interface ShareWorkoutInput {
  sessionId: string;
  visibility: "PRIVATE" | "FOLLOWERS" | "PUBLIC";
  caption?: string;
  showDetailedLoads: boolean;
}

/**
 * Publishes (or updates) a completed workout as a social Activity built
 * strictly from the session's own real data (spec §46.5 — never
 * frontend-fabricated performance values).
 */
export async function shareWorkoutSession(input: ShareWorkoutInput) {
  const user = await requireUserOrThrow();

  const session = await prisma.workoutSession.findUniqueOrThrow({
    where: { id: input.sessionId },
    include: {
      exerciseLogs: { include: { exercise: true, sets: true }, orderBy: { sortOrder: "asc" } },
      records: { include: { exercise: true } },
    },
  });
  if (session.userId !== user.id) throw new Error("FORBIDDEN");
  if (session.status !== "COMPLETED") throw new Error("SESSION_NOT_COMPLETED");

  await prisma.workoutSession.update({
    where: { id: session.id },
    data: {
      visibility: input.visibility,
      showDetailedLoads: input.showDetailedLoads,
      caption: input.caption?.slice(0, 280) || null,
    },
  });

  const summary = buildWorkoutActivitySummary(session, input.showDetailedLoads);

  await prisma.activity.upsert({
    where: { sessionId: session.id },
    create: {
      userId: user.id,
      type: "WORKOUT",
      sessionId: session.id,
      caption: input.caption?.slice(0, 280) || null,
      visibility: input.visibility,
      showDetailedLoads: input.showDetailedLoads,
      summary: summary as never,
    },
    update: {
      caption: input.caption?.slice(0, 280) || null,
      visibility: input.visibility,
      showDetailedLoads: input.showDetailedLoads,
      summary: summary as never,
    },
  });

  revalidatePath("/app/feed");
  revalidatePath(`/app/workout/${session.id}/summary`);
}

export async function setActivityVisibility(sessionId: string, visibility: "PRIVATE" | "FOLLOWERS" | "PUBLIC") {
  const user = await requireUserOrThrow();
  const activity = await prisma.activity.findUnique({ where: { sessionId } });
  if (!activity || activity.userId !== user.id) throw new Error("FORBIDDEN");
  await prisma.activity.update({ where: { id: activity.id }, data: { visibility } });
  revalidatePath("/app/feed");
}
