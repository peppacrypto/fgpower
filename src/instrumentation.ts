import { type Instrumentation } from "next";
import { captureServerError, logBootSummary } from "@/lib/observability/sink";

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
  // One-line config summary at boot (A-048), logged whether or not the
  // scheduler is on, so "scheduler=off" is visible too. No secrets.
  logBootSummary();
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

/**
 * Forward every server error Next captures (Server Components, Route Handlers,
 * Server Actions, the proxy) to the internal sink (A-048). Request headers are
 * deliberately NOT forwarded — they carry the session cookie.
 */
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  captureServerError({
    message: error instanceof Error ? error.message : String(error),
    digest:
      error && typeof error === "object" && "digest" in error
        ? String((error as { digest: unknown }).digest)
        : undefined,
    stack: error instanceof Error ? error.stack : undefined,
    path: request.path,
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType,
  });
};
