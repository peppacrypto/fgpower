"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { requireUserOrThrow } from "@/lib/auth/require-user";
import { SESSION_EXPIRED_ERROR } from "@/lib/auth/session-expired";
import { prisma } from "@/lib/db";
import { PublishError, upsertWorkoutActivity, type PublishedWorkout, type WorkoutVisibility } from "@/lib/social/publish";
import { newShareToken } from "@/lib/social/share-token";
import { workoutSummaryHref } from "@/lib/social/links";
import type { ActionResult } from "./result";

/**
 * The owner's sharing actions on a finished workout (the summary's "Quem vê"
 * and "Fora do app"). Each returns `{ ok, … }` or a pt-BR error — never
 * throws to the client (production masks thrown messages) — and an expired
 * session is SESSION_EXPIRED_ERROR (D-L).
 */

const VISIBILITIES: readonly WorkoutVisibility[] = ["PRIVATE", "FOLLOWERS", "PUBLIC"];

const GENERIC_ERROR = "Não foi possível salvar agora. Tente de novo.";
const SHARE_ERROR = "Não foi possível preparar o compartilhamento. Tente de novo.";
const MODERATED_ERROR = "Esta publicação foi ocultada pela moderação.";

const PUBLISH_ERRORS: Record<PublishError["code"], string> = {
  NOT_FOUND: "Este treino não existe mais.",
  NOT_COMPLETED: "Este treino ainda não foi salvo.",
  MODERATED: MODERATED_ERROR,
};

/** What the summary's share row holds after a save. */
export interface SharedState {
  activityId: string;
  visibility: WorkoutVisibility;
  showDetailedLoads: boolean;
  caption: string | null;
  /** The activity's updatedAt (ms): versions the story image. */
  version: number;
}

function toState(a: PublishedWorkout): SharedState {
  return {
    activityId: a.id,
    visibility: a.visibility,
    showDetailedLoads: a.showDetailedLoads,
    caption: a.caption,
    version: a.updatedAt.getTime(),
  };
}

function failure(err: unknown, fallback: string): { ok: false; error: string } {
  if (err instanceof PublishError) return { ok: false, error: PUBLISH_ERRORS[err.code] };
  console.error("sharing action failed", err);
  return { ok: false, error: fallback };
}

const readCaption = (v: unknown) => (typeof v === "string" ? v : undefined);

function revalidateShared(sessionId: string) {
  revalidatePath("/app/feed");
  revalidatePath(workoutSummaryHref(sessionId));
}

export interface ShareWorkoutInput {
  sessionId: string;
  visibility: WorkoutVisibility;
  caption?: string;
  showDetailedLoads: boolean;
}

/**
 * Publishes (or updates) a completed workout as a social Activity built
 * strictly from the session's own real data (spec §46.5 — never
 * frontend-fabricated performance values). PRIVATE keeps (or turns) it
 * visible to its owner only — and to whoever holds its share link, if it
 * has one.
 */
export async function shareWorkoutSession(input: ShareWorkoutInput): Promise<ActionResult<SharedState>> {
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return { ok: false, error: SESSION_EXPIRED_ERROR };
  // Server actions take any client input: accept only what the form can send.
  if (typeof input?.sessionId !== "string" || !VISIBILITIES.includes(input.visibility)) return { ok: false, error: GENERIC_ERROR };
  try {
    const published = await upsertWorkoutActivity({
      userId: user.id,
      sessionId: input.sessionId,
      visibility: input.visibility,
      showDetailedLoads: input.showDetailedLoads === true,
      caption: readCaption(input.caption) ?? null,
    });
    if (!published) return { ok: false, error: GENERIC_ERROR };
    revalidateShared(input.sessionId);
    return { ok: true, ...toState(published) };
  } catch (err) {
    return failure(err, GENERIC_ERROR);
  }
}

/**
 * "Compartilhar imagem" / "Copiar link": makes sure the workout has a share
 * link (/t/<token>) that shows it as it is on screen — the loads and caption
 * given — and returns its token. Who sees it in the app doesn't change: an
 * existing activity keeps its visibility, and a workout never published gets
 * an activity with the workout's own (session.visibility, W-008 §2) — so a
 * private workout stays PRIVATE, open only to its owner and to the link.
 * Race-safe: two quick taps get the same token.
 */
export async function ensureWorkoutShareLink(input: {
  sessionId: string;
  showDetailedLoads: boolean;
  caption?: string;
}): Promise<ActionResult<SharedState & { token: string }>> {
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return { ok: false, error: SESSION_EXPIRED_ERROR };
  if (typeof input?.sessionId !== "string") return { ok: false, error: SHARE_ERROR };
  try {
    const published = await upsertWorkoutActivity({
      userId: user.id,
      sessionId: input.sessionId,
      showDetailedLoads: input.showDetailedLoads === true,
      caption: readCaption(input.caption),
    });
    if (!published) return { ok: false, error: SHARE_ERROR };
    const linked = await mintShareToken(published.id);
    revalidateShared(input.sessionId);
    return { ok: true, ...toState({ ...published, updatedAt: linked.updatedAt }), token: linked.shareToken };
  } catch (err) {
    return failure(err, SHARE_ERROR);
  }
}

/**
 * The activity's token, minted when it has none. The token column is read
 * explicitly: lib/db.ts omits it from every row by default, and deciding
 * "no link yet" from a full row would mint a new token and kill the link
 * already sent.
 */
async function mintShareToken(activityId: string): Promise<{ shareToken: string; updatedAt: Date }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await prisma.activity.updateMany({
        where: { id: activityId, shareToken: null, moderatedAt: null },
        data: { shareToken: newShareToken(), sharedAt: new Date() },
      });
      break;
    } catch (err) {
      // A token collision (96 random bits: never, in practice) — draw again.
      if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") throw err;
    }
  }
  const row = await prisma.activity.findUniqueOrThrow({
    where: { id: activityId },
    select: { shareToken: true, updatedAt: true, moderatedAt: true },
  });
  if (row.moderatedAt) throw new PublishError("MODERATED");
  if (!row.shareToken) throw new Error("share token not minted");
  return { shareToken: row.shareToken, updatedAt: row.updatedAt };
}

/** "Desativar link": whoever opens the old link gets "link desativado". A later share mints a new one. */
export async function revokeWorkoutShareLink(sessionId: string): Promise<ActionResult> {
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return { ok: false, error: SESSION_EXPIRED_ERROR };
  if (typeof sessionId !== "string") return { ok: false, error: GENERIC_ERROR };
  try {
    await prisma.activity.updateMany({ where: { sessionId, userId: user.id }, data: { shareToken: null, sharedAt: null } });
  } catch (err) {
    return failure(err, "Não foi possível desativar o link agora. Tente de novo.");
  }
  revalidateShared(sessionId);
  return { ok: true };
}

/**
 * The summary's one-time question to a PRIVATE default (D-A), "Mostrar aos
 * seguidores": new workouts go to followers from now on, and this one too —
 * with the loads as the profile shows them (hidden unless the user turned
 * "Mostrar kg e reps" on).
 */
export async function showWorkoutsToFollowers(sessionId: string): Promise<ActionResult<SharedState>> {
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return { ok: false, error: SESSION_EXPIRED_ERROR };
  if (typeof sessionId !== "string") return { ok: false, error: GENERIC_ERROR };
  try {
    const [profile, session] = await Promise.all([
      prisma.profile.update({
        where: { userId: user.id },
        data: { defaultWorkoutVisibility: "FOLLOWERS" },
        select: { showLoadsPublicly: true },
      }),
      prisma.workoutSession.findFirst({ where: { id: sessionId, userId: user.id }, select: { finishedAt: true } }),
    ]);
    const published = await upsertWorkoutActivity({
      userId: user.id,
      sessionId,
      visibility: "FOLLOWERS",
      showDetailedLoads: profile.showLoadsPublicly,
      // Its own day in the feed, as auto-publish would have dated it.
      createdAt: session?.finishedAt ?? undefined,
    });
    if (!published) return { ok: false, error: GENERIC_ERROR };
    revalidateShared(sessionId);
    revalidatePath("/app/settings");
    return { ok: true, ...toState(published) };
  } catch (err) {
    return failure(err, GENERIC_ERROR);
  }
}
