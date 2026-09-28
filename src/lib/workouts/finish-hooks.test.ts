import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];
const publishOnFinish = vi.fn(async (): Promise<{ activityId: string } | null> => {
  calls.push("publish");
  return { activityId: "act-1" };
});
const syncRecordNotification = vi.fn(async (_userId: string, sessionId: string) => {
  calls.push(`records:${sessionId}`);
});
const syncWeekCompleteNotification = vi.fn(async () => {
  calls.push("week");
});
const syncMilestoneNotification = vi.fn(async (_userId: string, _sessionId: string, count: number) => {
  calls.push(`milestone:${count}`);
});

vi.mock("@/lib/social/publish", () => ({ publishOnFinish }));
vi.mock("@/lib/social/achievement-notifications", () => ({
  syncRecordNotification,
  syncWeekCompleteNotification,
  syncMilestoneNotification,
}));

const { afterFinish, afterRescore } = await import("./finish-hooks");

const ctx = { userId: "u1", sessionId: "s1", finishedAt: new Date("2026-09-28T15:00:00Z"), now: new Date("2026-09-28T15:05:00Z") };

beforeEach(() => {
  calls.length = 0;
  vi.clearAllMocks();
});

describe("afterFinish", () => {
  it("publishes, then the records, week and milestone notifications", async () => {
    expect(await afterFinish({ ...ctx, milestone: 10 })).toEqual({ activityId: "act-1" });
    expect(calls).toEqual(["publish", "records:s1", "week", "milestone:10"]);
    expect(publishOnFinish).toHaveBeenCalledWith("u1", "s1", ctx.finishedAt);
    expect(syncWeekCompleteNotification).toHaveBeenCalledWith("u1", "s1", ctx.finishedAt, ctx.now);
  });

  it("skips the milestone step without one", async () => {
    await afterFinish({ ...ctx, milestone: null });
    expect(calls).toEqual(["publish", "records:s1", "week"]);
  });

  it("a failing step never stops the next ones or throws", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    publishOnFinish.mockRejectedValueOnce(new Error("db down"));
    syncRecordNotification.mockRejectedValueOnce(new Error("db down"));
    expect(await afterFinish({ ...ctx, milestone: 25 })).toEqual({ activityId: null });
    expect(calls).toEqual(["week", "milestone:25"]);
    expect(error).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });
});

describe("afterRescore", () => {
  it("syncs each rescored workout's record notification, in order, past failures", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    syncRecordNotification.mockRejectedValueOnce(new Error("x"));
    await afterRescore("u1", ["a", "b", "c"]);
    expect(syncRecordNotification.mock.calls.map((c) => c[1])).toEqual(["a", "b", "c"]);
    expect(calls).toEqual(["records:b", "records:c"]);
    error.mockRestore();
  });
});
