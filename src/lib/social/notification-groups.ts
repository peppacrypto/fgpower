import { dayKey, startOfWeek } from "@/lib/training/week";

/**
 * The notifications page as a timeline (W-042): every FG on one workout is
 * one line ("Ana, Bruno e mais 3 deram FG no seu treino Push A"), and lines
 * fall under "Hoje", "Esta semana" or "Antes" by their latest moment. Pure.
 */

export interface GroupableRow {
  id: string;
  type: string;
  createdAt: Date;
  readAt: Date | null;
  activityId: string | null;
  actor: { id: string } | null;
}

export interface NotificationGroup<T extends GroupableRow> {
  /** Stable key: the newest row's id, or "fg:<activityId>" for FGs on one workout. */
  key: string;
  kind: "single" | "fg";
  /** The group's rows, newest first (one for "single"). */
  rows: T[];
  /** Who did it, newest first, each person once. */
  actors: NonNullable<T["actor"]>[];
  latestAt: Date;
  /** Any of its rows unread. */
  unread: boolean;
}

/** `rows` newest first (as loaded); the groups come out in the same order, by their newest row. */
export function groupNotifications<T extends GroupableRow>(rows: T[]): NotificationGroup<T>[] {
  const groups: NotificationGroup<T>[] = [];
  const fgGroups = new Map<string, NotificationGroup<T>>();
  for (const row of [...rows].sort((a, b) => +b.createdAt - +a.createdAt)) {
    if (row.type === "FG_RECEIVED" && row.activityId) {
      const existing = fgGroups.get(row.activityId);
      if (existing) {
        existing.rows.push(row);
        existing.unread ||= row.readAt === null;
        if (row.actor && !existing.actors.some((a) => a.id === row.actor!.id)) existing.actors.push(row.actor);
        continue;
      }
      const group: NotificationGroup<T> = {
        key: `fg:${row.activityId}`,
        kind: "fg",
        rows: [row],
        actors: row.actor ? [row.actor] : [],
        latestAt: row.createdAt,
        unread: row.readAt === null,
      };
      fgGroups.set(row.activityId, group);
      groups.push(group);
      continue;
    }
    groups.push({
      key: row.id,
      kind: "single",
      rows: [row],
      actors: row.actor ? [row.actor] : [],
      latestAt: row.createdAt,
      unread: row.readAt === null,
    });
  }
  return groups;
}

export type NotificationBucket = "today" | "week" | "earlier";

export const BUCKET_LABEL: Record<NotificationBucket, string> = {
  today: "Hoje",
  week: "Esta semana",
  earlier: "Antes",
};

/** "Hoje" (the same São Paulo day), "Esta semana" (since Monday), else "Antes". */
export function bucketOf(date: Date, now: Date): NotificationBucket {
  if (dayKey(date) === dayKey(now)) return "today";
  if (date >= startOfWeek(now)) return "week";
  return "earlier";
}
