"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/require-user";
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

async function notify(
  recipientId: string,
  actorId: string | null,
  type: NotificationType,
  extra: { activityId?: string; followRequestId?: string } = {},
) {
  if (recipientId === actorId) return; // never notify yourself
  await prisma.notification.create({ data: { recipientId, actorId, type, ...extra } });
}

export async function followUser(targetUserId: string) {
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
  } else {
    const existing = await prisma.followRequest.findUnique({
      where: { requesterId_targetId: { requesterId: user.id, targetId: targetUserId } },
    });
    if (!existing) {
      const request = await prisma.followRequest.create({
        data: { requesterId: user.id, targetId: targetUserId, status: "PENDING" },
      });
      await notify(targetUserId, user.id, "FOLLOW_REQUEST", { followRequestId: request.id });
    }
  }
  revalidatePath("/u");
}

export async function unfollowUser(targetUserId: string) {
  const user = await requireUserOrThrow();
  await prisma.follow.deleteMany({ where: { followerId: user.id, followingId: targetUserId } });
  await prisma.followRequest.deleteMany({ where: { requesterId: user.id, targetId: targetUserId, status: "PENDING" } });
  revalidatePath("/u");
}

export async function respondToFollowRequest(requestId: string, accept: boolean) {
  const user = await requireUserOrThrow();
  const request = await prisma.followRequest.findUniqueOrThrow({ where: { id: requestId } });
  if (request.targetId !== user.id) throw new Error("FORBIDDEN");
  if (request.status !== "PENDING") return;

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
}

export async function giveFg(activityId: string) {
  const user = await requireUserOrThrow();
  const activity = await prisma.activity.findUniqueOrThrow({ where: { id: activityId } });
  if (activity.userId === user.id) throw new Error("CANNOT_FG_OWN_ACTIVITY");
  // Can't react to an activity you're not allowed to see (private / non-followed / blocked).
  if (!(await canViewActivity(user.id, activity))) throw new Error("FORBIDDEN");

  const existing = await prisma.activityFG.findUnique({ where: { activityId_userId: { activityId, userId: user.id } } });
  if (existing) return { fgCount: activity.fgCount };

  await prisma.$transaction([
    prisma.activityFG.create({ data: { activityId, userId: user.id } }),
    prisma.activity.update({ where: { id: activityId }, data: { fgCount: { increment: 1 } } }),
  ]);
  await notify(activity.userId, user.id, "FG_RECEIVED", { activityId });
  revalidatePath("/app/feed");
  return { fgCount: activity.fgCount + 1 };
}

export async function removeFg(activityId: string) {
  const user = await requireUserOrThrow();
  const existing = await prisma.activityFG.findUnique({ where: { activityId_userId: { activityId, userId: user.id } } });
  if (!existing) return;
  await prisma.$transaction([
    prisma.activityFG.delete({ where: { activityId_userId: { activityId, userId: user.id } } }),
    prisma.activity.update({ where: { id: activityId }, data: { fgCount: { decrement: 1 } } }),
  ]);
  revalidatePath("/app/feed");
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
}) {
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
  return { ok: true };
}

export async function markNotificationsRead(ids: string[]) {
  const user = await requireUserOrThrow();
  await prisma.notification.updateMany({
    where: { id: { in: ids }, recipientId: user.id },
    data: { readAt: new Date() },
  });
  revalidatePath("/app/notifications");
}
