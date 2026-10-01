import "server-only";
import { Prisma, type NotificationType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { NOT_BANNED } from "./authorization";

/**
 * The in-app notification service: the ONLY writer of Notification rows.
 * Server-only, and never inside a 'use server' file (every export there would
 * become a public endpoint). Every row about one event carries a dedupeKey
 * (notificationKey), unique per recipient, so an FG given twice or a
 * follow/unfollow/follow never stacks rows; rows about the user's own
 * achievements (actorId null) are created already read — an achievements log
 * that never lights the unread pip.
 */

/** A Prisma client or an interactive transaction's client. */
type Db = Prisma.TransactionClient | typeof prisma;

/** The dedupe keys, one per kind of event (M1 backfilled existing rows with the same shapes). */
export const notificationKey = {
  fg: (activityId: string, actorId: string) => `fg:${activityId}:${actorId}`,
  follower: (actorId: string) => `follower:${actorId}`,
  request: (actorId: string) => `request:${actorId}`,
  accepted: (actorId: string) => `accepted:${actorId}`,
  records: (sessionId: string) => `pr:${sessionId}`,
  /** São Paulo Monday day number of the week (one row per week, ever). */
  week: (monday: number) => `week:${monday}`,
  block: (enrollmentId: string) => `block:${enrollmentId}`,
  /** The 10th/25th/50th/100th workout. */
  milestone: (count: number) => `milestone:${count}`,
} as const;

/**
 * What a second event with the same key does:
 * - "keep": nothing — one row per event, ever (FG given, taken back, given again);
 * - "rearm": the row moves to the top as new (createdAt now, unread, the new links/data);
 * - { rearmIfReadBefore }: rearm only a row read before that date (a re-follow a
 *   month later notifies again; an unread or recently read row stays as it is);
 * - "update": the row keeps its place and read state; only its links and data
 *   change (a workout's records row after a correction).
 */
export type DuplicatePolicy = "keep" | "rearm" | "update" | { rearmIfReadBefore: Date };

export interface NotificationInput {
  recipientId: string;
  /** Who did it; null for the user's own achievements (records, week, block, milestone). */
  actorId: string | null;
  type: NotificationType;
  /** notificationKey.*; null = never deduplicated. */
  dedupeKey: string | null;
  activityId?: string | null;
  followRequestId?: string | null;
  /** The workout a record / week / milestone row is about (deleting it deletes the row). */
  sessionId?: string | null;
  data?: Prisma.InputJsonValue;
  /** Created (or re-armed) already read: achievements log rows. */
  read?: boolean;
  /** Default "keep". Ignored without a dedupeKey. */
  onDuplicate?: DuplicatePolicy;
}

export interface NotificationWrite {
  /** A new row was inserted. */
  created: boolean;
  /** An existing row was moved to the top as new. */
  rearmed: boolean;
}

const NOTHING: NotificationWrite = { created: false, rearmed: false };

/**
 * Records one event for its recipient. Skips notifying yourself and pairs
 * with a block in either direction. Race-safe: the unique (recipientId,
 * dedupeKey) index decides between two concurrent writers. The result is the
 * hook a caller can use to fan a new event out elsewhere (e.g. Web Push).
 */
export async function createNotification(db: Db, input: NotificationInput, now: Date = new Date()): Promise<NotificationWrite> {
  const { recipientId, actorId, dedupeKey } = input;
  if (actorId && actorId === recipientId) return NOTHING;
  if (actorId && (await blockedPair(db, actorId, recipientId))) return NOTHING;

  const links = {
    actorId,
    type: input.type,
    activityId: input.activityId ?? null,
    followRequestId: input.followRequestId ?? null,
    sessionId: input.sessionId ?? null,
  };
  const readAt = input.read ? now : null;

  if (dedupeKey === null) {
    await db.notification.create({ data: { recipientId, ...links, data: input.data, readAt, createdAt: now } });
    return { created: true, rearmed: false };
  }

  const insert = async () => {
    const { count } = await db.notification.createMany({
      data: [{ recipientId, dedupeKey, ...links, data: input.data, readAt, createdAt: now }],
      skipDuplicates: true,
    });
    return count === 1;
  };
  const rearm = async (): Promise<NotificationWrite> => {
    await db.notification.update({
      where: { recipientId_dedupeKey: { recipientId, dedupeKey } },
      data: { ...links, data: input.data ?? Prisma.DbNull, readAt, createdAt: now },
    });
    return { created: false, rearmed: true };
  };

  const policy = input.onDuplicate ?? "keep";
  if (policy === "keep") return (await insert()) ? { created: true, rearmed: false } : NOTHING;
  if (policy === "update") {
    if (await insert()) return { created: true, rearmed: false };
    await db.notification.updateMany({
      where: { recipientId, dedupeKey },
      data: { ...links, data: input.data ?? Prisma.DbNull },
    });
    return NOTHING;
  }

  const existing = await db.notification.findUnique({
    where: { recipientId_dedupeKey: { recipientId, dedupeKey } },
    select: { readAt: true },
  });
  if (!existing) {
    if (await insert()) return { created: true, rearmed: false };
    // Lost a race with another writer of the same event: theirs stands.
    return policy === "rearm" ? rearm() : NOTHING;
  }
  if (policy === "rearm") return rearm();
  return existing.readAt && existing.readAt < policy.rearmIfReadBefore ? rearm() : NOTHING;
}

/**
 * Takes an event back (an FG removed, an unfollow). By default only while the
 * recipient hasn't seen it: a row already read stays as history.
 */
export async function retractNotification(
  db: Db,
  p: { recipientId: string; dedupeKey: string; onlyUnread?: boolean },
): Promise<number> {
  const { count } = await db.notification.deleteMany({
    where: { recipientId: p.recipientId, dedupeKey: p.dedupeKey, ...(p.onlyUnread === false ? {} : { readAt: null }) },
  });
  return count;
}

/**
 * The rows the inbox shows: your own achievements and what people did — not
 * what a banned person did (they disappear with their account; an unban
 * brings the rows back). The unread count must count exactly these: a banned
 * account can still act for a few minutes on its cached session, and a row
 * the inbox hides would light the pip for good — opening the inbox could
 * never clear it.
 */
export const SHOWN_NOTIFICATION = { OR: [{ actorId: null }, { actor: NOT_BANNED }] } satisfies Prisma.NotificationWhereInput;

/** Unread notifications (other people's actions; achievements are created read), as the inbox shows them. */
export async function countUnread(userId: string): Promise<number> {
  return prisma.notification.count({ where: { recipientId: userId, readAt: null, ...SHOWN_NOTIFICATION } });
}

/**
 * Marks as seen what the user was shown: unread rows created up to `upTo`
 * (the newest row on the rendered list). Rows that arrived after that render
 * stay unread. Returns how many are left unread.
 */
export async function markSeen(userId: string, upTo: Date, now: Date = new Date()): Promise<number> {
  await prisma.notification.updateMany({
    where: { recipientId: userId, readAt: null, createdAt: { lte: upTo } },
    data: { readAt: now },
  });
  return countUnread(userId);
}

async function blockedPair(db: Db, a: string, b: string): Promise<boolean> {
  const n = await db.userBlock.count({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
  });
  return n > 0;
}
