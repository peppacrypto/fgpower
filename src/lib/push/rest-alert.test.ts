import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { REST_ALERT_NEXT_MAX, RestAlertScheduler, cleanNext, restAlertPayload } from "./rest-alert";

describe("RestAlertScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends at the end of the rest, once", async () => {
    const s = new RestAlertScheduler();
    const fire = vi.fn();
    expect(s.schedule("u1", 1, 90_000, fire)).toBe("scheduled");
    expect(s.pending("u1")).toBe(true);
    await vi.advanceTimersByTimeAsync(89_999);
    expect(fire).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(fire).toHaveBeenCalledTimes(1);
    expect(s.pending("u1")).toBe(false);
    await vi.advanceTimersByTimeAsync(600_000);
    expect(fire).toHaveBeenCalledTimes(1);
  });

  it("a new rest replaces the pending one (one per user), other users untouched", async () => {
    const s = new RestAlertScheduler();
    const first = vi.fn();
    const second = vi.fn();
    const other = vi.fn();
    s.schedule("u1", 1, 60_000, first);
    s.schedule("u2", 1, 60_000, other);
    expect(s.schedule("u1", 2, 30_000, second)).toBe("scheduled");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(other).toHaveBeenCalledTimes(1);
  });

  it("skipping the rest takes it back", async () => {
    const s = new RestAlertScheduler();
    const fire = vi.fn();
    s.schedule("u1", 5, 60_000, fire);
    expect(s.cancel("u1", 6)).toBe(true);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fire).not.toHaveBeenCalled();
    expect(s.cancel("u1", 7)).toBe(false);
  });

  it("requests that arrive out of order can't revive a rest taken back or undo a newer one", async () => {
    const s = new RestAlertScheduler();
    const late = vi.fn();
    const newer = vi.fn();
    // The take-back (seq 11) overtakes the schedule it follows (seq 10).
    expect(s.cancel("u1", 11)).toBe(false);
    expect(s.schedule("u1", 10, 60_000, late)).toBe("stale");
    // A newer rest (seq 13) is not taken back by an older take-back (seq 12 arriving after it).
    expect(s.schedule("u1", 13, 60_000, newer)).toBe("scheduled");
    expect(s.cancel("u1", 12)).toBe(false);
    expect(s.schedule("u1", 13, 10_000, late)).toBe("stale");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(late).not.toHaveBeenCalled();
    expect(newer).toHaveBeenCalledTimes(1);
  });

  it("a failing send is logged, never thrown", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const s = new RestAlertScheduler();
    s.schedule("u1", 1, 1000, () => Promise.reject(new Error("push service down")));
    await vi.advanceTimersByTimeAsync(1000);
    expect(warn).toHaveBeenCalledWith("[rest-alert] send failed", "push service down");
    warn.mockRestore();
  });
});

describe("the notification", () => {
  it("says the rest ended and what comes next, and opens the workout", () => {
    expect(restAlertPayload({ sessionId: "s1", kind: "rest", next: "Série 2 · Supino reto" })).toEqual({
      title: "Descanso acabou",
      body: "Série 2 · Supino reto",
      url: "/app/workout/s1",
      tag: "rest-end",
    });
    expect(restAlertPayload({ sessionId: "s1", kind: "transition", next: null })).toMatchObject({
      title: "Hora de trocar de exercício",
      body: "Hora da próxima série.",
    });
  });

  it("keeps the client's line to one short plain line", () => {
    expect(cleanNext("  Série 2\n·\tSupino\u0000 reto ")).toBe("Série 2 · Supino reto");
    expect(cleanNext("   ")).toBeNull();
    expect(cleanNext(null)).toBeNull();
    const long = cleanNext("x".repeat(500))!;
    expect(long).toHaveLength(REST_ALERT_NEXT_MAX);
    expect(long.endsWith("…")).toBe(true);
  });
});
