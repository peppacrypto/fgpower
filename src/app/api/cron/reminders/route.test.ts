import { afterEach, describe, expect, it, vi } from "vitest";

const { runReminderTick } = vi.hoisted(() => ({ runReminderTick: vi.fn() }));
vi.mock("@/lib/reminders/engine", () => ({ runReminderTick }));

import { POST } from "./route";

/** POST /api/cron/reminders (W-017): who may run the tick, and how `dry` and `now` reach it. */

const call = (query = "", authorization?: string) =>
  POST(new Request(`http://localhost/api/cron/reminders${query}`, { method: "POST", headers: authorization ? { authorization } : {} }));

afterEach(() => {
  vi.unstubAllEnvs();
  runReminderTick.mockReset();
});

describe("the reminder tick route", () => {
  it("doesn't exist without a CRON_SECRET", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("", "Bearer anything")).status).toBe(404);
    expect(runReminderTick).not.toHaveBeenCalled();
  });

  it("refuses a missing, wrong or non-bearer secret", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    for (const header of [undefined, "Bearer wrong!", "Bearer s3cre", "Bearer s3cret2", "Basic s3cret", "s3cret"]) {
      expect((await call("", header)).status).toBe(401);
    }
    expect(runReminderTick).not.toHaveBeenCalled();
  });

  it("runs the tick with the bearer; ?dry=1 decides without writing; ?now= only outside production", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    runReminderTick.mockResolvedValue({ ran: true, sent: 0 });
    const res = await call("?dry=1&now=2026-10-05T10:05:00.000Z", "Bearer s3cret");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ran: true, sent: 0 });
    expect(runReminderTick).toHaveBeenLastCalledWith(new Date("2026-10-05T10:05:00.000Z"), { dryRun: true });

    expect((await call("?now=yesterday", "Bearer s3cret")).status).toBe(400);

    vi.stubEnv("NODE_ENV", "production");
    const before = Date.now();
    await call("?now=2020-01-01T00:00:00.000Z", "Bearer s3cret");
    const [now, deps] = runReminderTick.mock.lastCall as [Date, { dryRun: boolean }];
    expect(now.getTime()).toBeGreaterThanOrEqual(before);
    expect(deps).toEqual({ dryRun: false });
  });
});
