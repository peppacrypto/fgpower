import "server-only";
import { prisma } from "@/lib/db";
import { activityHref, profileHref, workoutSummaryHref } from "@/lib/social/links";
import { SHOWN_NOTIFICATION } from "@/lib/social/notifications";
import { bucketOf, groupNotifications, type NotificationBucket } from "@/lib/social/notification-groups";
import type { RequestStatus } from "@/lib/social/notification-text";
import { formatFullDateTime, formatRelativeTime } from "@/lib/utils/relative-time";
import { PUBLIC_USER_SELECT, toPublicUser, type PublicUser } from "./public-user";

/**
 * The notifications page's rows (W-042, W-138), ready to draw: FGs on one
 * workout merged into one line, a bucket (Hoje / Esta semana / Antes), the
 * relative time computed here (no clock in the client), the link, and — for
 * someone who follows you — whether "Seguir de volta" applies. Writing
 * notifications is lib/social/notifications.ts (createNotification), never here.
 */

/** Raw rows read: FG groups fold many into one line. */
const RAW_LIMIT = 120;
/** Lines shown. */
const LINE_LIMIT = 60;

/** The viewer's relation to someone, as FollowButton takes it. */
export type ViewerRelation = "NONE" | "REQUESTED" | "FOLLOWING";

export interface NotificationLine {
  /** Stable key: the row id, or "fg:<activityId>" for FGs on one workout. */
  key: string;
  type: string;
  bucket: NotificationBucket;
  /** The latest moment (ISO), its relative label ("há 5 min") and the full date for the tooltip. */
  at: string;
  timeLabel: string;
  fullTime: string;
  unread: boolean;
  /** Who did it, newest first, each once (empty for your own achievements). */
  actors: PublicUser[];
  href: string | null;
  /** FG lines: the workout's name. */
  workoutName: string | null;
  /** Your own achievements' payload (records, week, program, milestone). */
  data: unknown;
  followRequest: { id: string; status: RequestStatus } | null;
  /**
   * NEW_FOLLOWER and FOLLOW_REQUEST lines: the person, how the viewer relates
   * to them now, and whether their account is private — "Seguir de volta"
   * shows when the relation is NONE (and, for a request, once it is accepted).
   */
  followBack: { relation: ViewerRelation; isPrivate: boolean } | null;
}

export async function getNotifications(
  userId: string,
  now: Date = new Date(),
): Promise<{ lines: NotificationLine[]; unread: number; newestAt: string | null }> {
  const rows = await prisma.notification.findMany({
    // A banned person's traces disappear with them (the same rows the unread count leaves out).
    where: { recipientId: userId, ...SHOWN_NOTIFICATION },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: RAW_LIMIT,
    select: {
      id: true,
      type: true,
      createdAt: true,
      readAt: true,
      activityId: true,
      sessionId: true,
      data: true,
      actor: { select: PUBLIC_USER_SELECT },
      activity: { select: { id: true, session: { select: { name: true } } } },
      followRequest: { select: { id: true, status: true } },
    },
  });

  // "Seguir de volta": the viewer's relation to people who follow (or asked to follow) them.
  const followerIds = [
    ...new Set(
      rows.filter((r) => r.actor && (r.type === "NEW_FOLLOWER" || r.type === "FOLLOW_REQUEST")).map((r) => r.actor!.id),
    ),
  ];
  const [following, requested, profiles] =
    followerIds.length === 0
      ? [[], [], []]
      : await Promise.all([
          prisma.follow.findMany({ where: { followerId: userId, followingId: { in: followerIds } }, select: { followingId: true } }),
          prisma.followRequest.findMany({
            where: { requesterId: userId, targetId: { in: followerIds }, status: "PENDING" },
            select: { targetId: true },
          }),
          prisma.profile.findMany({ where: { userId: { in: followerIds } }, select: { userId: true, isPublicAccount: true } }),
        ]);
  const followingSet = new Set(following.map((f) => f.followingId));
  const requestedSet = new Set(requested.map((r) => r.targetId));
  const isPublic = new Map(profiles.map((p) => [p.userId, p.isPublicAccount]));

  const groups = groupNotifications(rows).slice(0, LINE_LIMIT);
  const lines = groups.map((g): NotificationLine => {
    const row = g.rows[0];
    const actor = row.actor ? toPublicUser(row.actor) : null;
    const followBack =
      actor && isPublic.has(actor.id) && (row.type === "NEW_FOLLOWER" || row.type === "FOLLOW_REQUEST")
        ? {
            relation: followingSet.has(actor.id) ? ("FOLLOWING" as const) : requestedSet.has(actor.id) ? ("REQUESTED" as const) : ("NONE" as const),
            isPrivate: isPublic.get(actor.id) === false,
          }
        : null;
    return {
      key: g.key,
      type: row.type,
      bucket: bucketOf(g.latestAt, now),
      at: g.latestAt.toISOString(),
      timeLabel: formatRelativeTime(g.latestAt, now),
      fullTime: formatFullDateTime(g.latestAt),
      unread: g.unread,
      actors: g.actors.map(toPublicUser),
      href: hrefOf(row, actor),
      workoutName: row.activity?.session?.name ?? null,
      data: row.actor ? null : row.data,
      followRequest: row.followRequest ? { id: row.followRequest.id, status: row.followRequest.status as RequestStatus } : null,
      followBack,
    };
  });

  return {
    lines,
    unread: rows.filter((r) => r.readAt === null).length,
    newestAt: rows[0]?.createdAt.toISOString() ?? null,
  };
}

/** Where a line leads: the workout, the summary, the history, or the person. */
function hrefOf(
  row: { type: string; activityId: string | null; sessionId: string | null },
  actor: PublicUser | null,
): string | null {
  switch (row.type) {
    case "FG_RECEIVED":
    case "PROGRAM_COMPLETED":
      return row.activityId ? activityHref(row.activityId) : null;
    case "PERSONAL_RECORD":
    case "WORKOUT_MILESTONE":
      return row.sessionId ? workoutSummaryHref(row.sessionId) : null;
    case "PROGRAM_WEEK_COMPLETE":
      return "/app/history";
    default:
      return actor?.username ? profileHref(actor.username) : null;
  }
}
