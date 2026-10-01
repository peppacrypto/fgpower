/**
 * Starts the reminder scheduler (W-017) in the Node.js server process: a
 * tick every 5 minutes that POSTs the app's own /api/cron/reminders over
 * loopback with the CRON_SECRET bearer. Calling the route instead of the
 * engine keeps one module graph (one Prisma client), and the same endpoint
 * serves an external cron or a manual dry run. Only where
 * REMINDER_SCHEDULER=on (the production web service; never a shared dev
 * server). The route's lease keeps a deploy overlap to one runner.
 * `register` never waits for a tick.
 */
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.REMINDER_SCHEDULER !== "on") return;
  if (!process.env.CRON_SECRET) {
    console.warn("[reminders] REMINDER_SCHEDULER=on but CRON_SECRET is unset — scheduler off");
    return;
  }
  const g = globalThis as { __fgReminderTimer?: ReturnType<typeof setInterval> };
  if (g.__fgReminderTimer) return;
  const port = process.env.PORT ?? "3000";

  const tick = async () => {
    for (const host of ["127.0.0.1", "[::1]"]) {
      try {
        const res = await fetch(`http://${host}:${port}/api/cron/reminders`, {
          method: "POST",
          headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
          signal: AbortSignal.timeout(240_000),
        });
        if (!res.ok) console.warn("[reminders] tick answered", res.status);
        return;
      } catch {
        // Try the next loopback address.
      }
    }
    console.warn("[reminders] tick: the server is unreachable over loopback");
  };

  // After boot (and a deploy overlap), then every 5 minutes.
  setTimeout(() => void tick(), 60_000).unref();
  g.__fgReminderTimer = setInterval(() => void tick(), 5 * 60_000);
  g.__fgReminderTimer.unref();
}
