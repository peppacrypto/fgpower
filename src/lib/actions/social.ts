"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/require-user";
import { SESSION_EXPIRED_ERROR } from "@/lib/auth/session-expired";
import { prisma } from "@/lib/db";
import { isBlocked, canViewActivity } from "@/lib/social/authorization";

type NotificationType =
  | "FG_RECEIVED"
  | "NEW_FOLLOWER"
  | "FOLLOW_REQUEST"
  | "FOLLOW_ACCEPTED"
  | "PERSONAL_RECORD"
  | "PROGRAM_WEEK_COMPLETE"
  | "PROGRAM_COMPLETED";

/** Outcome of a social action the UI calls directly (no redirect, no throw). */
export type SocialResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

const ERROR_TEXT: Record<string, string> = {
  // Only signed-in screens call these, so a missing session means it expired.
  UNAUTHORIZED: SESSION_EXPIRED_ERROR,
  FORBIDDEN: "Você não tem acesso a isso.",
  BLOCKED: "Não é possível interagir com esta conta.",
  NOT_FOUND: "Isso não existe mais.",
  USER_NOT_FOUND: "Esta conta não existe mais.",
  CANNOT_FOLLOW_SELF: "Você não pode seguir a si mesmo.",
  CANNOT_FG_OWN_ACTIVITY: "Você não pode dar FG no próprio treino.",
};

/**
 * Runs an action body and turns its throws into `{ ok: false, error }` with
 * pt-BR copy, so a failed FG / follow / reply is an inline, rolled-back
 * state on the client instead of the full-page error boundary.
 */
async function attempt<T extends object>(body: () => Promise<T>): Promise<SocialResult<T>> {
  try {
    return { ok: true, ...(await body()) };
  } catch (err) {
    const code = (err as { code?: string }).code === "P2025" ? "NOT_FOUND" : err instanceof Error ? err.message : "";
    if (!(code in ERROR_TEXT)) console.error("social action failed", err);
    return { ok: false, error: ERROR_TEXT[code] ?? "Não foi possível concluir agora. Tente de novo." };
  }
}

async function notify(
  recipientId: string,
  actorId: string | null,
  type: NotificationType,
  extra: { activityId?: string; followRequestId?: string } = {},
) {
  if (recipientId === actorId) return; // never notify yourself
  await prisma.notification.create({ data: { recipientId, actorId, type, ...extra } });
}

export async function followUser(targetUserId: string): Promise<SocialResult<{ status: "FOLLOWING" | "REQUESTED" }>> {
  return attempt(async () => {
    const user = await requireUserOrThrow();
    if (user.id === targetUserId) throw new Error("CANNOT_FOLLOW_SELF");
    if (await isBlocked(user.id, targetUserId)) throw new Error("BLOCKED");

    const target = await prisma.profile.findUnique({ where: { userId: targetUserId }, select: { isPublicAccount: true } });
    if (!target) throw new Error("USER_NOT_FOUND");

    if (target.isPublicAccount) {
      await prisma.follow.upsert({
        where: { followerId_followingId: { followerId: user.id, followingId: targetUserId } },
        create: { followerId: user.id, followingId: targetUserId },
        update: {},
      });
      await notify(targetUserId, user.id, "NEW_FOLLOWER");
      revalidatePath("/u");
      return { status: "FOLLOWING" as const };
    }

    const existing = await prisma.followRequest.findUnique({
      where: { requesterId_targetId: { requesterId: user.id, targetId: targetUserId } },
    });
    if (!existing) {
      const request = await prisma.followRequest.create({
        data: { requesterId: user.id, targetId: targetUserId, status: "PENDING" },
      });
      await notify(targetUserId, user.id, "FOLLOW_REQUEST", { followRequestId: request.id });
    }
    revalidatePath("/u");
    return { status: "REQUESTED" as const };
  });
}

export async function unfollowUser(targetUserId: string): Promise<SocialResult> {
  return attempt(async () => {
    const user = await requireUserOrThrow();
    await prisma.follow.deleteMany({ where: { followerId: user.id, followingId: targetUserId } });
    await prisma.followRequest.deleteMany({ where: { requesterId: user.id, targetId: targetUserId, status: "PENDING" } });
    revalidatePath("/u");
    return {};
  });
}

export async function respondToFollowRequest(
  requestId: string,
  accept: boolean,
): Promise<SocialResult<{ status: "ACCEPTED" | "DECLINED" }>> {
  return attempt(async () => {
    const user = await requireUserOrThrow();
    const request = await prisma.followRequest.findUniqueOrThrow({ where: { id: requestId } });
    if (request.targetId !== user.id) throw new Error("FORBIDDEN");
    // Already answered (another tab / device): report what actually stands.
    if (request.status !== "PENDING") {
      return { status: request.status === "ACCEPTED" ? ("ACCEPTED" as const) : ("DECLINED" as const) };
    }

    await prisma.followRequest.update({
      where: { id: requestId },
      data: { status: accept ? "ACCEPTED" : "DECLINED", respondedAt: new Date() },
    });

    if (accept) {
      await prisma.follow.upsert({
        where: { followerId_followingId: { followerId: request.requesterId, followingId: request.targetId } },
        create: { followerId: request.requesterId, followingId: request.targetId },
        update: {},
      });
      await notify(request.requesterId, user.id, "FOLLOW_ACCEPTED");
    }
    revalidatePath("/app/notifications");
    return { status: accept ? ("ACCEPTED" as const) : ("DECLINED" as const) };
  });
}

export async function giveFg(activityId: string): Promise<SocialResult<{ fgCount: number }>> {
  return attempt(async () => {
    const user = await requireUserOrThrow();
    const activity = await prisma.activity.findUniqueOrThrow({ where: { id: activityId } });
    if (activity.userId === user.id) throw new Error("CANNOT_FG_OWN_ACTIVITY");
    // Can't react to an activity you're not allowed to see (private / non-followed / blocked).
    if (!(await canViewActivity(user.id, activity))) throw new Error("FORBIDDEN");

    const existing = await prisma.activityFG.findUnique({ where: { activityId_userId: { activityId, userId: user.id } } });
    if (existing) return { fgCount: activity.fgCount };

    const [, updated] = await prisma.$transaction([
      prisma.activityFG.create({ data: { activityId, userId: user.id } }),
      prisma.activity.update({ where: { id: activityId }, data: { fgCount: { increment: 1 } }, select: { fgCount: true } }),
    ]);
    await notify(activity.userId, user.id, "FG_RECEIVED", { activityId });
    revalidatePath("/app/feed");
    return { fgCount: updated.fgCount };
  });
}

export async function removeFg(activityId: string): Promise<SocialResult<{ fgCount: number }>> {
  return attempt(async () => {
    const user = await requireUserOrThrow();
    const existing = await prisma.activityFG.findUnique({ where: { activityId_userId: { activityId, userId: user.id } } });
    if (!existing) {
      const activity = await prisma.activity.findUniqueOrThrow({ where: { id: activityId }, select: { fgCount: true } });
      return { fgCount: activity.fgCount };
    }
    const [, updated] = await prisma.$transaction([
      prisma.activityFG.delete({ where: { activityId_userId: { activityId, userId: user.id } } }),
      prisma.activity.update({ where: { id: activityId }, data: { fgCount: { decrement: 1 } }, select: { fgCount: true } }),
    ]);
    revalidatePath("/app/feed");
    return { fgCount: updated.fgCount };
  });
}

export async function blockUser(targetUserId: string) {
  const user = await requireUserOrThrow();
  if (user.id === targetUserId) throw new Error("CANNOT_BLOCK_SELF");
  await prisma.$transaction([
    prisma.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId: user.id, blockedId: targetUserId } },
      create: { blockerId: user.id, blockedId: targetUserId },
      update: {},
    }),
    prisma.follow.deleteMany({ where: { OR: [{ followerId: user.id, followingId: targetUserId }, { followerId: targetUserId, followingId: user.id }] } }),
    prisma.followRequest.deleteMany({ where: { OR: [{ requesterId: user.id, targetId: targetUserId }, { requesterId: targetUserId, targetId: user.id }] } }),
  ]);
  revalidatePath("/u");
}

export async function unblockUser(targetUserId: string) {
  const user = await requireUserOrThrow();
  await prisma.userBlock.deleteMany({ where: { blockerId: user.id, blockedId: targetUserId } });
  revalidatePath("/app/settings/blocked");
}

export async function reportContent(input: {
  reportedUserId?: string;
  activityId?: string;
  reason: "SPAM" | "HARASSMENT" | "INAPPROPRIATE_CONTENT" | "FAKE_DATA" | "OTHER";
  details?: string;
}): Promise<SocialResult> {
  return attempt(async () => {
    const user = await requireUserOrThrow();
    await prisma.userReport.create({
      data: {
        reporterId: user.id,
        reportedUserId: input.reportedUserId,
        activityId: input.activityId,
        reason: input.reason,
        details: input.details?.slice(0, 1000),
      },
    });
    return {};
  });
}

export async function markNotificationsRead(ids: string[]) {
  const user = await requireUserOrThrow();
  await prisma.notification.updateMany({
    where: { id: { in: ids }, recipientId: user.id },
    data: { readAt: new Date() },
  });
  revalidatePath("/app/notifications");
}
