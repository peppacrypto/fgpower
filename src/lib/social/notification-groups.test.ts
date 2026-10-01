import { describe, expect, it } from "vitest";
import { bucketOf, groupNotifications, type GroupableRow } from "./notification-groups";

const sp = (iso: string) => new Date(`${iso}-03:00`);

let seq = 0;
function row(p: Partial<Omit<GroupableRow, "actor" | "createdAt">> & { at: string; actor?: string | null }): GroupableRow {
  seq += 1;
  return {
    id: p.id ?? `n${seq}`,
    type: p.type ?? "FG_RECEIVED",
    createdAt: sp(p.at),
    readAt: p.readAt === undefined ? sp(p.at) : p.readAt,
    activityId: p.activityId ?? null,
    actor: p.actor === null ? null : { id: p.actor ?? "ana" },
  };
}

describe("groupNotifications", () => {
  it("merges FGs on one workout, newest first, each person once", () => {
    const groups = groupNotifications([
      row({ at: "2026-09-28T10:00:00", activityId: "a1", actor: "ana" }),
      row({ at: "2026-09-28T12:00:00", activityId: "a1", actor: "bruno" }),
      row({ at: "2026-09-28T11:00:00", activityId: "a1", actor: "ana" }),
      row({ at: "2026-09-28T09:00:00", activityId: "a2", actor: "caio" }),
    ]);
    expect(groups.map((g) => g.key)).toEqual(["fg:a1", "fg:a2"]);
    expect(groups[0].actors.map((a) => a.id)).toEqual(["bruno", "ana"]);
    expect(groups[0].rows).toHaveLength(3);
    expect(groups[0].latestAt).toEqual(sp("2026-09-28T12:00:00"));
    expect(groups[0].kind).toBe("fg");
  });

  it("is unread when any of its rows is", () => {
    const [group] = groupNotifications([
      row({ at: "2026-09-28T10:00:00", activityId: "a1", actor: "ana", readAt: null }),
      row({ at: "2026-09-28T12:00:00", activityId: "a1", actor: "bruno" }),
    ]);
    expect(group.unread).toBe(true);
  });

  it("leaves other kinds one line each, in time order among the groups", () => {
    const groups = groupNotifications([
      row({ at: "2026-09-28T08:00:00", type: "NEW_FOLLOWER", actor: "ana", id: "f1" }),
      row({ at: "2026-09-28T09:00:00", type: "NEW_FOLLOWER", actor: "bruno", id: "f2" }),
      row({ at: "2026-09-28T10:00:00", activityId: "a1", actor: "caio" }),
      row({ at: "2026-09-28T07:00:00", type: "PERSONAL_RECORD", actor: null, id: "pr" }),
    ]);
    expect(groups.map((g) => g.key)).toEqual(["fg:a1", "f2", "f1", "pr"]);
    expect(groups.find((g) => g.key === "pr")?.actors).toEqual([]);
    expect(groups.find((g) => g.key === "f1")?.kind).toBe("single");
  });

  it("keeps an FG without its activity as its own line", () => {
    const groups = groupNotifications([row({ at: "2026-09-28T10:00:00", activityId: null, id: "x" })]);
    expect(groups.map((g) => g.key)).toEqual(["x"]);
  });
});

describe("bucketOf", () => {
  // Wednesday 30/09/2026, 20:00 in São Paulo.
  const now = sp("2026-09-30T20:00:00");

  it("puts the same São Paulo day under Hoje, even past midnight UTC", () => {
    expect(bucketOf(sp("2026-09-30T00:05:00"), now)).toBe("today");
    expect(bucketOf(sp("2026-09-30T22:30:00"), sp("2026-09-30T23:59:00"))).toBe("today");
  });

  it("puts the rest of the week (from Monday) under Esta semana, and older under Antes", () => {
    expect(bucketOf(sp("2026-09-29T23:59:00"), now)).toBe("week");
    expect(bucketOf(sp("2026-09-28T00:00:00"), now)).toBe("week");
    expect(bucketOf(sp("2026-09-27T23:59:00"), now)).toBe("earlier");
  });
});
