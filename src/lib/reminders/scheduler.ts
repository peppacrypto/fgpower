import "server-only";

/**
 * Whether the in-process reminder scheduler (src/instrumentation.ts) is
 * configured to run in this deployment: REMINDER_SCHEDULER=on AND a CRON_SECRET
 * to authorize the loopback tick. When this is false a tick is never fired, so
 * reminders are neither sent nor offered (A-048).
 */
export function reminderSchedulerEnabled(): boolean {
  return process.env.REMINDER_SCHEDULER === "on" && Boolean(process.env.CRON_SECRET?.trim());
}
