import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { register } from "./instrumentation";

/** The reminder scheduler (W-017): when it starts, what it calls, and that it starts once. */

type Scheduler = { __fgReminderTimer?: ReturnType<typeof setInterval> };
const scheduler = globalThis as Scheduler;
const fetchMock = vi.fn();
const ok = () => new Response("{}", { status: 200 });

function schedulerOn(env: Record<string, string> = {}) {
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
  vi.stubEnv("REMINDER_SCHEDULER", "on");
  vi.stubEnv("CRON_SECRET", "s3cret");
  vi.stubEnv("PORT", "8080");
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  delete scheduler.__fgReminderTimer;
});
afterEach(() => {
  if (scheduler.__fgReminderTimer) clearInterval(scheduler.__fgReminderTimer);
  delete scheduler.__fgReminderTimer;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("register (src/instrumentation.ts)", () => {
  it("stays off outside the Node.js runtime, without REMINDER_SCHEDULER=on, or without CRON_SECRET", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const off: Record<string, string>[] = [{ NEXT_RUNTIME: "edge" }, { REMINDER_SCHEDULER: "" }, { REMINDER_SCHEDULER: "1" }, { CRON_SECRET: "" }];
    for (const env of off) {
      schedulerOn(env);
      register();
      await vi.advanceTimersByTimeAsync(10 * 60_000);
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(scheduler.__fgReminderTimer).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("CRON_SECRET is unset"));
  });

  it("ticks a minute after boot, then every 5 minutes, over loopback with the bearer — started once", async () => {
    schedulerOn();
    fetchMock.mockImplementation(async () => ok());
    register();
    register(); // a second call (a re-import) keeps the one timer
    await vi.advanceTimersByTimeAsync(59_000);
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:8080/api/cron/reminders");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ authorization: "Bearer s3cret" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    await vi.advanceTimersByTimeAsync(4 * 60_000); // 5:00
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(10 * 60_000); // 10:00, 15:00
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("tries [::1] when 127.0.0.1 refuses, and only warns when neither answers or the tick fails", async () => {
    schedulerOn({ PORT: "3000" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(ok())
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response("{}", { status: 500 }));
    register();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock.mock.calls.map(([u]) => u)).toEqual([
      "http://127.0.0.1:3000/api/cron/reminders",
      "http://[::1]:3000/api/cron/reminders",
    ]);
    expect(warn).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(4 * 60_000); // 5:00: both refuse
    expect(warn).toHaveBeenLastCalledWith(expect.stringContaining("unreachable"));
    await vi.advanceTimersByTimeAsync(5 * 60_000); // 10:00: answered 500
    expect(warn).toHaveBeenLastCalledWith("[reminders] tick answered", 500);
  });
});
