"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { buildWorkoutActivitySummary } from "@/lib/social/activity-summary";

const VISIBILITIES: readonly ShareWorkoutInput["visibility"][] = ["PRIVATE", "FOLLOWERS", "PUBLIC"];

export interface ShareWorkoutInput {
  sessionId: string;
  visibility: "PRIVATE" | "FOLLOWERS" | "PUBLIC";
  caption?: string;
  showDetailedLoads: boolean;
}

/**
 * Publishes (or updates) a completed workout as a social Activity built
 * strictly from the session's own real data (spec §46.5 — never
 * frontend-fabricated performance values). PRIVATE keeps (or turns) it
 * visible to its owner only. Returns the activity's id, for "Copiar link".
 */
export async function shareWorkoutSession(input: ShareWorkoutInput): Promise<{ activityId: string }> {
  const user = await requireUserOrThrow();

  // Server actions take any client input: accept only what the form can send.
  if (typeof input?.sessionId !== "string" || !VISIBILITIES.includes(input.visibility)) throw new Error("INVALID");
  const visibility = input.visibility;
  const showDetailedLoads = input.showDetailedLoads === true;
  const caption = typeof input.caption === "string" ? input.caption.trim().slice(0, 280) || null : null;

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
    // Sharing isn't an edit: keep updatedAt so the 24 h correction window
    // (summary "Editar séries") still counts from when the workout was saved.
    data: { visibility, showDetailedLoads, caption, updatedAt: session.updatedAt },
  });

  const summary = buildWorkoutActivitySummary(session, showDetailedLoads);

  const activity = await prisma.activity.upsert({
    where: { sessionId: session.id },
    create: {
      userId: user.id,
      type: "WORKOUT",
      sessionId: session.id,
      caption,
      visibility,
      showDetailedLoads,
      summary: summary as never,
    },
    update: { caption, visibility, showDetailedLoads, summary: summary as never },
    select: { id: true },
  });

  revalidatePath("/app/feed");
  revalidatePath(`/app/workout/${session.id}/summary`);
  return { activityId: activity.id };
}

export async function setActivityVisibility(sessionId: string, visibility: "PRIVATE" | "FOLLOWERS" | "PUBLIC") {
  const user = await requireUserOrThrow();
  const activity = await prisma.activity.findUnique({ where: { sessionId } });
  if (!activity || activity.userId !== user.id) throw new Error("FORBIDDEN");
  await prisma.activity.update({ where: { id: activity.id }, data: { visibility } });
  revalidatePath("/app/feed");
}
