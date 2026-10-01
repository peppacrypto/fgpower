import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { buildWorkoutActivitySummary } from "@/lib/social/activity-summary";

/**
 * Publishing a finished workout to the feed (W-048 auto-publish, W-008 share
 * links): the one place a WORKOUT activity is written from a session. Server
 * only, and never inside a 'use server' file.
 */

/**
 * The sharing defaults onboarding writes into a new profile (decision 10,
 * D-A): new profiles publish to their followers, loads hidden (showLoadsPublicly
 * keeps its false default). Existing profiles keep what they had — a
 * PRIVATE default sees the summary's one-time question instead.
 */
export const NEW_PROFILE_SHARING = { defaultWorkoutVisibility: "FOLLOWERS" } as const;

export type WorkoutVisibility = "PRIVATE" | "FOLLOWERS" | "PUBLIC";

/** Why upsertWorkoutActivity refused: the caller maps these to its own copy. */
export class PublishError extends Error {
  constructor(public code: "NOT_FOUND" | "NOT_COMPLETED" | "MODERATED") {
    super(code);
  }
}

export interface PublishedWorkout {
  id: string;
  visibility: WorkoutVisibility;
  showDetailedLoads: boolean;
  caption: string | null;
  updatedAt: Date;
}

const PUBLISHED_SELECT = { id: true, visibility: true, showDetailedLoads: true, caption: true, updatedAt: true } as const;

/**
 * Creates or updates the WORKOUT activity of one of `userId`'s finished
 * sessions, with its card built from the session's own sets and records
 * (never from the client). The session keeps the same choices (visibility,
 * loads, caption) without its updatedAt moving: sharing isn't an edit, and
 * the 24 h correction window counts from the save.
 * - `visibility` undefined: an existing activity keeps its own, a new one
 *   takes the session's.
 * - `caption` undefined: kept; null or blank: cleared.
 * - `createOnly`: an existing activity is left untouched (auto-publish);
 *   returns null then, and when a concurrent writer created it first.
 * A moderated activity (hidden by an admin) can't be changed: MODERATED —
 * also when the hide lands while this runs (the write is conditional).
 */
export async function upsertWorkoutActivity(opts: {
  userId: string;
  sessionId: string;
  visibility?: WorkoutVisibility;
  showDetailedLoads: boolean;
  caption?: string | null;
  createdAt?: Date;
  createOnly?: boolean;
}): Promise<PublishedWorkout | null> {
  const session = await prisma.workoutSession.findFirst({
    where: { id: opts.sessionId, userId: opts.userId },
    include: {
      exerciseLogs: { include: { exercise: true, sets: true }, orderBy: { sortOrder: "asc" } },
      records: { include: { exercise: true } },
      activity: { select: { id: true, visibility: true, caption: true, moderatedAt: true } },
    },
  });
  if (!session) throw new PublishError("NOT_FOUND");
  if (session.status !== "COMPLETED" || !session.finishedAt) throw new PublishError("NOT_COMPLETED");
  const existing = session.activity;
  if (existing && opts.createOnly) return null;
  if (existing?.moderatedAt) throw new PublishError("MODERATED");

  const visibility = opts.visibility ?? existing?.visibility ?? session.visibility;
  const caption =
    opts.caption === undefined ? (existing?.caption ?? session.caption ?? null) : opts.caption?.trim().slice(0, 280) || null;
  const showDetailedLoads = opts.showDetailedLoads;
  const summary = buildWorkoutActivitySummary(session, showDetailedLoads) as unknown as Prisma.InputJsonValue;

  const card = { visibility, showDetailedLoads, caption, summary };
  // The session follows in the same transaction as the activity's write, so a
  // write refused below leaves it as it was.
  const sessionChanged =
    session.visibility !== visibility || session.showDetailedLoads !== showDetailedLoads || session.caption !== caption;
  const syncSession = async (tx: Prisma.TransactionClient) => {
    if (!sessionChanged) return;
    await tx.workoutSession.update({
      where: { id: session.id },
      data: { visibility, showDetailedLoads, caption, updatedAt: session.updatedAt },
    });
  };

  // Only while still unmoderated at the write: an admin's "Ocultar treino" that
  // lands after the read above wins, instead of being published again here.
  // The post's row first, then its workout's: every writer of both takes them
  // in this order (the moderation in lib/actions/admin.ts, activity-owner.ts),
  // or two landing together deadlock (admin.lock-order.integration.test.ts).
  const updateUnmoderated = (where: { id: string } | { sessionId: string }) =>
    prisma.$transaction(async (tx) => {
      const { count } = await tx.activity.updateMany({
        where: { ...where, userId: opts.userId, moderatedAt: null },
        data: { ...card, updatedAt: new Date() },
      });
      if (count === 0) {
        // Hidden meanwhile: MODERATED. Deleted meanwhile (another tab, a moderator): a plain failure, and a retry creates it.
        const current = await tx.activity.findUnique({ where, select: { moderatedAt: true } });
        throw current?.moderatedAt ? new PublishError("MODERATED") : new Error("the activity was deleted while publishing");
      }
      await syncSession(tx);
      return tx.activity.findUniqueOrThrow({ where, select: PUBLISHED_SELECT });
    });

  if (existing) return updateUnmoderated({ id: existing.id });
  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.activity.create({
        data: {
          userId: opts.userId,
          type: "WORKOUT",
          sessionId: session.id,
          ...card,
          ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
        },
        select: PUBLISHED_SELECT,
      });
      await syncSession(tx);
      return created;
    });
  } catch (err) {
    // Another writer (auto-publish vs. a tap, two tabs) created it first.
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") throw err;
    if (opts.createOnly) return null;
    return updateUnmoderated({ sessionId: session.id });
  }
}

/**
 * Creates the WORKOUT activity for a just-finished session with the
 * session's own visibility and loads flag (set from the profile's defaults
 * when it was opened), dated `finishedAt` — a workout saved late sits at its
 * own day in the feed. Nothing when the session is PRIVATE (including every
 * session opened before auto-publish) or already has an activity; never
 * mints a share token. Returns the activity it created, or null.
 */
export async function publishOnFinish(userId: string, sessionId: string, finishedAt: Date): Promise<{ activityId: string } | null> {
  const session = await prisma.workoutSession.findFirst({
    where: { id: sessionId, userId, status: "COMPLETED" },
    select: { visibility: true, showDetailedLoads: true, activity: { select: { id: true } } },
  });
  if (!session || session.visibility === "PRIVATE" || session.activity) return null;
  const created = await upsertWorkoutActivity({
    userId,
    sessionId,
    visibility: session.visibility,
    showDetailedLoads: session.showDetailedLoads,
    createdAt: finishedAt,
    createOnly: true,
  });
  return created ? { activityId: created.id } : null;
}
