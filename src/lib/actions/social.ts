"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { requireUserOrThrow } from "@/lib/auth/require-user";
import { SESSION_EXPIRED_ERROR } from "@/lib/auth/session-expired";
import { prisma } from "@/lib/db";
import { PUBLIC_USER_SELECT, toPublicUser } from "@/lib/data/social/public-user";
import { activityAccess, canViewActivity, isBlocked } from "@/lib/social/authorization";
import { createNotification, markSeen, notificationKey, retractNotification } from "@/lib/social/notifications";
import { notifyAdminsOfNewReport } from "@/lib/social/notification-reports";
import {
  REPORT_DETAILS_STORED_MAX,
  REPORTS_PER_DAY,
  goneWorkoutOf,
  isReportReason,
  type ReportReasonCode,
} from "@/lib/social/notification-reports-core";
import type { ActionResult } from "./result";

/**
 * Outcome of a social action the UI calls directly (no redirect, no throw).
 *
 * Revalidating inside an action makes the router re-render the page the user
 * is on, whatever path was named. The follow, request, remove-follower and
 * block actions therefore don't: their buttons settle on the result in place
 * (a "Seguir de volta" or "Removido" row must not vanish mid-tap), and every
 * page that shows these relations is rendered per request anyway.
 */
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
  CANNOT_BLOCK_SELF: "Você não pode bloquear a si mesmo.",
  CANNOT_REPORT_SELF: "Você não pode denunciar a si mesmo.",
  CANNOT_REPORT_OWN_ACTIVITY: "Você não pode denunciar o próprio treino.",
  INVALID_REASON: "Escolha um motivo.",
  REPORT_LIMIT: "Você enviou muitas denúncias hoje. Tente de novo amanhã.",
};

/** A re-follow or re-accept notifies again only when the old row was read over a month ago. */
const REARM_AFTER_MS = 30 * 86_400_000;

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

/** A unique-index collision: a concurrent double tap got there first. */
function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string })?.code === "P2002";
}

/** A string id from a client (server actions are public endpoints: never trust the shape). */
function idOf(value: unknown, code = "NOT_FOUND"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 200) throw new Error(code);
  return value;
}

// ---------------------------------------------------------------------------
// Following
// ---------------------------------------------------------------------------

/**
 * Follows a public account, or asks a private one. Honest about what stands:
 * "REQUESTED" only when a PENDING request really exists — a request left
 * ACCEPTED (after an unfollow) or DECLINED is reset to PENDING and the
 * target notified again (one row per requester, moved back to the top);
 * asking twice while PENDING changes nothing. A concurrent double tap
 * answers the real state instead of an error.
 */
export async function followUser(targetUserId: string): Promise<SocialResult<{ status: "FOLLOWING" | "REQUESTED" }>> {
  return attempt(async () => {
    const user = await requireUserOrThrow();
    const targetId = idOf(targetUserId, "USER_NOT_FOUND");
    if (user.id === targetId) throw new Error("CANNOT_FOLLOW_SELF");
    if (await isBlocked(user.id, targetId)) throw new Error("BLOCKED");

    const target = await prisma.user.findUnique({
      where: { id: targetId },
      select: { banned: true, profile: { select: { isPublicAccount: true } } },
    });
    if (!target || target.banned === true || !target.profile) throw new Error("USER_NOT_FOUND");

    const pair = { followerId_followingId: { followerId: user.id, followingId: targetId } };
    if (await prisma.follow.findUnique({ where: pair, select: { followerId: true } })) {
      return { status: "FOLLOWING" as const };
    }
    const now = new Date();

    if (target.profile.isPublicAccount) {
      try {
        await prisma.$transaction([
          prisma.follow.upsert({ where: pair, create: { followerId: user.id, followingId: targetId }, update: {} }),
          // A leftover from when the account was private.
          prisma.followRequest.deleteMany({ where: { requesterId: user.id, targetId } }),
        ]);
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        return { status: "FOLLOWING" as const };
      }
      await createNotification(
        prisma,
        {
          recipientId: targetId,
          actorId: user.id,
          type: "NEW_FOLLOWER",
          dedupeKey: notificationKey.follower(user.id),
          onDuplicate: { rearmIfReadBefore: new Date(now.getTime() - REARM_AFTER_MS) },
        },
        now,
      );
      return { status: "FOLLOWING" as const };
    }

    const pairKey = { requesterId_targetId: { requesterId: user.id, targetId } };
    const existing = await prisma.followRequest.findUnique({ where: pairKey, select: { id: true, status: true } });
    if (existing?.status === "PENDING") return { status: "REQUESTED" as const };

    let requestId: string;
    if (existing) {
      // ACCEPTED (they unfollowed since) or DECLINED: asking again is allowed.
      const reset = await prisma.followRequest.updateMany({
        where: { id: existing.id, status: { not: "PENDING" } },
        data: { status: "PENDING", createdAt: now, respondedAt: null },
      });
      if (reset.count === 0) return { status: "REQUESTED" as const };
      requestId = existing.id;
    } else {
      try {
        requestId = (
          await prisma.followRequest.create({
            data: { requesterId: user.id, targetId, status: "PENDING", createdAt: now },
            select: { id: true },
          })
        ).id;
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        return { status: "REQUESTED" as const };
      }
    }
    await createNotification(
      prisma,
      {
        recipientId: targetId,
        actorId: user.id,
        type: "FOLLOW_REQUEST",
        followRequestId: requestId,
        dedupeKey: notificationKey.request(user.id),
        onDuplicate: "rearm",
      },
      now,
    );
    return { status: "REQUESTED" as const };
  });
}

/**
 * Unfollows, or cancels a request (any status: an ACCEPTED leftover would
 * otherwise block asking again). The request's notification goes with it
 * (FK cascade); a "começou a seguir você" the person hasn't seen yet is taken
 * back too.
 */
export async function unfollowUser(targetUserId: string): Promise<SocialResult<{ status: "NONE" }>> {
  return attempt(async () => {
    const user = await requireUserOrThrow();
    const targetId = idOf(targetUserId, "USER_NOT_FOUND");
    await prisma.$transaction([
      prisma.follow.deleteMany({ where: { followerId: user.id, followingId: targetId } }),
      prisma.followRequest.deleteMany({ where: { requesterId: user.id, targetId } }),
    ]);
    await retractNotification(prisma, { recipientId: targetId, dedupeKey: notificationKey.follower(user.id), onlyUnread: true });
    return { status: "NONE" as const };
  });
}

/**
 * Accepts or declines a request made to the signed-in user. Already answered
 * (another tab, another device): says what actually stands. The requester
 * hears of an acceptance once (again only if they had read it over a month
 * ago — the same key and policy as the private → public switch).
 */
export async function respondToFollowRequest(
  requestId: string,
  accept: boolean,
): Promise<SocialResult<{ status: "ACCEPTED" | "DECLINED" }>> {
  return attempt(async () => {
    const user = await requireUserOrThrow();
    const id = idOf(requestId);
    const request = await prisma.followRequest.findUnique({ where: { id } });
    if (!request) throw new Error("NOT_FOUND");
    if (request.targetId !== user.id) throw new Error("FORBIDDEN");
    const settled = (status: string) => ({ status: status === "ACCEPTED" ? ("ACCEPTED" as const) : ("DECLINED" as const) });
    if (request.status !== "PENDING") return settled(request.status);

    const now = new Date();
    const flipped = await prisma.$transaction(async (tx) => {
      const { count } = await tx.followRequest.updateMany({
        where: { id, status: "PENDING" },
        data: { status: accept ? "ACCEPTED" : "DECLINED", respondedAt: now },
      });
      if (count === 0) return false;
      if (accept) {
        await tx.follow.upsert({
          where: { followerId_followingId: { followerId: request.requesterId, followingId: user.id } },
          create: { followerId: request.requesterId, followingId: user.id },
          update: {},
        });
      }
      return true;
    });
    if (!flipped) {
      const current = await prisma.followRequest.findUnique({ where: { id }, select: { status: true } });
      if (!current) throw new Error("NOT_FOUND");
      return settled(current.status);
    }
    if (accept) {
      await createNotification(
        prisma,
        {
          recipientId: request.requesterId,
          actorId: user.id,
          type: "FOLLOW_ACCEPTED",
          dedupeKey: notificationKey.accepted(user.id),
          onDuplicate: { rearmIfReadBefore: new Date(now.getTime() - REARM_AFTER_MS) },
        },
        now,
      );
    }
    return settled(accept ? "ACCEPTED" : "DECLINED");
  });
}

/**
 * Removes someone from your followers (W-141): their follow and any request
 * of theirs go; they aren't told. A private account then has them ask again.
 */
export async function removeFollower(followerId: string): Promise<SocialResult<{ status: "REMOVED" }>> {
  return attempt(async () => {
    const user = await requireUserOrThrow();
    const id = idOf(followerId, "USER_NOT_FOUND");
    await prisma.$transaction([
      prisma.follow.deleteMany({ where: { followerId: id, followingId: user.id } }),
      prisma.followRequest.deleteMany({ where: { requesterId: id, targetId: user.id } }),
    ]);
    await retractNotification(prisma, { recipientId: user.id, dedupeKey: notificationKey.follower(id), onlyUnread: true });
    return { status: "REMOVED" as const };
  });
}

// ---------------------------------------------------------------------------
// FG
// ---------------------------------------------------------------------------

/**
 * Gives an FG. The author hears of it once per workout and giver, ever: FG,
 * take it back, FG again never stacks rows. A concurrent double tap (the
 * unique ActivityFG row) counts once and answers the real count.
 */
export async function giveFg(activityId: string): Promise<SocialResult<{ fgCount: number }>> {
  return attempt(async () => {
    const user = await requireUserOrThrow();
    const id = idOf(activityId);
    const activity = await prisma.activity.findUniqueOrThrow({
      where: { id },
      select: { id: true, userId: true, visibility: true, fgCount: true },
    });
    if (activity.userId === user.id) throw new Error("CANNOT_FG_OWN_ACTIVITY");
    // Can't react to an activity you're not allowed to see (private / non-followed / blocked / banned).
    if (!(await canViewActivity(user.id, activity))) throw new Error("FORBIDDEN");

    const pair = { activityId_userId: { activityId: id, userId: user.id } };
    if (await prisma.activityFG.findUnique({ where: pair, select: { userId: true } })) return { fgCount: activity.fgCount };

    let fgCount: number;
    try {
      const [, updated] = await prisma.$transaction([
        prisma.activityFG.create({ data: { activityId: id, userId: user.id } }),
        prisma.activity.update({ where: { id }, data: { fgCount: { increment: 1 } }, select: { fgCount: true } }),
      ]);
      fgCount = updated.fgCount;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      const current = await prisma.activity.findUniqueOrThrow({ where: { id }, select: { fgCount: true } });
      return { fgCount: current.fgCount };
    }
    await createNotification(prisma, {
      recipientId: activity.userId,
      actorId: user.id,
      type: "FG_RECEIVED",
      activityId: id,
      dedupeKey: notificationKey.fg(id, user.id),
      onDuplicate: "keep",
    });
    revalidatePath("/app/feed");
    return { fgCount };
  });
}

/**
 * Takes an FG back. An FG the author hasn't seen yet leaves no trace; one
 * already read stays as history (and giving it again won't notify again).
 * An FG already gone (another tab, a double tap) is not an error: the answer
 * is the current count.
 */
export async function removeFg(activityId: string): Promise<SocialResult<{ fgCount: number }>> {
  return attempt(async () => {
    const user = await requireUserOrThrow();
    const id = idOf(activityId);
    const activity = await prisma.activity.findUniqueOrThrow({ where: { id }, select: { userId: true } });
    const { removed, fgCount } = await prisma.$transaction(async (tx) => {
      // The post's row before its FG's, the order a post's deletion (it cascades to its FGs) and
      // blockUser take them: the other way round, one landing meanwhile deadlocked with this
      // (social.lock-order.integration.test.ts). It's the lock the count's write below takes anyway;
      // a post deleted meanwhile answers NOT_FOUND.
      await tx.$queryRaw`SELECT id FROM "Activity" WHERE id = ${id} FOR NO KEY UPDATE`;
      const del = await tx.activityFG.deleteMany({ where: { activityId: id, userId: user.id } });
      if (del.count > 0) {
        await tx.activity.updateMany({ where: { id, fgCount: { gt: 0 } }, data: { fgCount: { decrement: 1 } } });
      }
      const current = await tx.activity.findUniqueOrThrow({ where: { id }, select: { fgCount: true } });
      return { removed: del.count > 0, fgCount: current.fgCount };
    });
    if (removed) {
      await retractNotification(prisma, { recipientId: activity.userId, dedupeKey: notificationKey.fg(id, user.id), onlyUnread: true });
      revalidatePath("/app/feed");
    }
    return { fgCount };
  });
}

// ---------------------------------------------------------------------------
// Blocking
// ---------------------------------------------------------------------------

/**
 * Blocks someone (W-141): neither sees the other's profile or workouts. The
 * two stop following each other, pending requests and the notifications
 * between them go, and each one's FGs on the other's workouts are taken back
 * (with the counts recomputed). They aren't told.
 */
export async function blockUser(targetUserId: string): Promise<SocialResult<{ status: "BLOCKED" }>> {
  return attempt(async () => {
    const user = await requireUserOrThrow();
    const targetId = idOf(targetUserId, "USER_NOT_FOUND");
    if (user.id === targetId) throw new Error("CANNOT_BLOCK_SELF");
    if (!(await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } }))) throw new Error("USER_NOT_FOUND");
    const me = user.id;

    await prisma.$transaction(async (tx) => {
      const crossFgs = {
        OR: [
          { userId: me, activity: { userId: targetId } },
          { userId: targetId, activity: { userId: me } },
        ],
      } satisfies Prisma.ActivityFGWhereInput;
      const touched = await tx.activityFG.findMany({ where: crossFgs, select: { activityId: true } });
      const ids = [...new Set(touched.map((f) => f.activityId))];
      // The posts those FGs are on, before any row below: a post's deletion takes its row and then
      // cascades to its FGs and their notifications, and removeFg takes it before its FG. Taken
      // after them, either one landing meanwhile deadlocked with this (social.lock-order.integration.test.ts).
      if (ids.length > 0) {
        await tx.$queryRaw`SELECT id FROM "Activity" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR NO KEY UPDATE`;
      }
      await tx.userBlock.upsert({
        where: { blockerId_blockedId: { blockerId: me, blockedId: targetId } },
        create: { blockerId: me, blockedId: targetId },
        update: {},
      });
      await tx.follow.deleteMany({
        where: { OR: [{ followerId: me, followingId: targetId }, { followerId: targetId, followingId: me }] },
      });
      await tx.followRequest.deleteMany({
        where: { OR: [{ requesterId: me, targetId }, { requesterId: targetId, targetId: me }] },
      });
      await tx.notification.deleteMany({
        where: { OR: [{ recipientId: me, actorId: targetId }, { recipientId: targetId, actorId: me }] },
      });
      if (ids.length > 0) {
        // Only on the posts locked above, the ones recounted below: an FG given on another of
        // their posts after the read above stays, counted, as one given just after the block would.
        await tx.activityFG.deleteMany({ where: { ...crossFgs, activityId: { in: ids } } });
        await tx.$executeRaw`
          UPDATE "Activity" SET "fgCount" = (SELECT count(*) FROM "ActivityFG" f WHERE f."activityId" = "Activity"."id")
          WHERE "id" IN (${Prisma.join(ids)})`;
      }
    });
    return { status: "BLOCKED" as const };
  });
}

/** Unblocks. Nothing comes back by itself: follows were ended by the block. */
export async function unblockUser(targetUserId: string): Promise<SocialResult<{ status: "UNBLOCKED" }>> {
  return attempt(async () => {
    const user = await requireUserOrThrow();
    const targetId = idOf(targetUserId, "USER_NOT_FOUND");
    await prisma.userBlock.deleteMany({ where: { blockerId: user.id, blockedId: targetId } });
    return { status: "UNBLOCKED" as const };
  });
}

// ---------------------------------------------------------------------------
// Reporting (decision 15)
// ---------------------------------------------------------------------------

export interface ReportInput {
  /** A person (the /u "⋯" menu). Filled in from the activity for a workout report. */
  reportedUserId?: string;
  /** A workout (the activity page, /t). */
  activityId?: string;
  reason: ReportReasonCode;
  details?: string;
  /** The share token of /t/<token>: a viewer who only holds the link may report that workout. */
  shareToken?: string;
}

/**
 * Files a report for the admins. A workout must be one the reporter can see
 * (in the app, or through its share link) and not their own; a person must
 * exist and not be the reporter. The same open report twice is one report;
 * more than REPORTS_PER_DAY in 24 h is refused. What was reported is kept in
 * `snapshot`, so the evidence survives the post being deleted. The admins
 * get one e-mail when their queue goes from empty to not empty.
 * `blocked`: the reporter already blocked the person (no "Bloquear também").
 */
export async function reportContent(input: ReportInput): Promise<SocialResult<{ blocked: boolean }>> {
  return attempt(async () => {
    const user = await requireUserOrThrow();
    if (!input || !isReportReason(input.reason)) throw new Error("INVALID_REASON");
    const details = typeof input.details === "string" ? input.details.trim().slice(0, REPORT_DETAILS_STORED_MAX) || null : null;

    let reportedUserId: string;
    let activityId: string | null = null;
    let snapshot: Prisma.InputJsonValue;

    if (input.activityId !== undefined && input.activityId !== null) {
      activityId = idOf(input.activityId);
      const activity = await prisma.activity.findUnique({
        where: { id: activityId },
        select: {
          id: true,
          userId: true,
          type: true,
          visibility: true,
          caption: true,
          summary: true,
          createdAt: true,
          user: { select: PUBLIC_USER_SELECT },
        },
      });
      if (!activity) throw new Error("NOT_FOUND");
      if (activity.userId === user.id) throw new Error("CANNOT_REPORT_OWN_ACTIVITY");
      const token = typeof input.shareToken === "string" ? input.shareToken : null;
      if ((await activityAccess(user.id, activity, token)) === "none") throw new Error("FORBIDDEN");
      reportedUserId = activity.userId;
      const summary = (activity.summary ?? {}) as { workoutName?: unknown };
      snapshot = {
        kind: "activity",
        activityId: activity.id,
        type: activity.type,
        visibility: activity.visibility,
        workoutName: typeof summary.workoutName === "string" ? summary.workoutName : null,
        caption: activity.caption,
        createdAt: activity.createdAt.toISOString(),
        author: toPublicUser(activity.user),
      };
    } else if (input.reportedUserId !== undefined && input.reportedUserId !== null) {
      reportedUserId = idOf(input.reportedUserId, "USER_NOT_FOUND");
      if (reportedUserId === user.id) throw new Error("CANNOT_REPORT_SELF");
      const target = await prisma.user.findUnique({
        where: { id: reportedUserId },
        select: { ...PUBLIC_USER_SELECT, profile: { select: { displayName: true, bio: true } } },
      });
      if (!target) throw new Error("USER_NOT_FOUND");
      snapshot = { kind: "user", user: { ...toPublicUser(target), bio: target.profile?.bio ?? null } };
    } else {
      throw new Error("NOT_FOUND");
    }

    const blocked = (await prisma.userBlock.count({ where: { blockerId: user.id, blockedId: reportedUserId } })) > 0;

    // The same open report twice (a double tap, a second try) is one report. About the person: not
    // an open report of yours about a post of theirs deleted since (it lost its activityId too).
    const duplicate = activityId
      ? await prisma.userReport.findFirst({ where: { reporterId: user.id, activityId, status: "OPEN" }, select: { id: true } })
      : (
          await prisma.userReport.findMany({
            where: { reporterId: user.id, reportedUserId, activityId: null, status: "OPEN" },
            select: { snapshot: true },
          })
        ).find((r) => goneWorkoutOf(r.snapshot) === null);
    if (duplicate) return { blocked };

    const since = new Date(Date.now() - 86_400_000);
    if ((await prisma.userReport.count({ where: { reporterId: user.id, createdAt: { gte: since } } })) >= REPORTS_PER_DAY) {
      throw new Error("REPORT_LIMIT");
    }

    await prisma.userReport.create({
      data: { reporterId: user.id, reportedUserId, activityId, reason: input.reason, details, snapshot },
    });
    const reason = input.reason;
    after(() => notifyAdminsOfNewReport({ reason }));
    return { blocked };
  });
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

/**
 * Marks as seen the notifications the user was shown: unread rows up to
 * `upToIso` (the newest row on the list they opened). Rows that arrived after
 * that render stay unread. Called once from the page after it mounted — never
 * during a render or a prefetch — and it doesn't revalidate (that would wipe
 * the "new" markers on screen). Returns how many are still unread.
 */
export async function markNotificationsSeen(upToIso: string): Promise<ActionResult<{ unread: number }>> {
  const user = await requireUserOrThrow().catch(() => null);
  if (!user) return { ok: false, error: SESSION_EXPIRED_ERROR };
  const upTo = typeof upToIso === "string" ? new Date(upToIso) : new Date(Number.NaN);
  if (Number.isNaN(upTo.getTime())) return { ok: false, error: "Não foi possível concluir agora. Tente de novo." };
  const now = new Date();
  const unread = await markSeen(user.id, upTo > now ? now : upTo, now);
  return { ok: true, unread };
}
