import type { PushPayload } from "./send";

/**
 * The end-of-rest notification. A page can't signal the end of a rest on a
 * locked iPhone (its timers stop) and often can't beep on one at all, so
 * while a rest runs the workout asks this server to push one notification to
 * the device that rests, at the moment the rest ends
 * (/api/workout/rest-alert, the client's rest-notification.ts), and takes it
 * back when the rest is skipped, paused, cut short or replaced.
 *
 * It is no reminder (lib/reminders): the user asked for it by resting, it goes
 * to that one device, and it counts toward no cap and waits for no quiet hour.
 *
 * Kept in this process's memory, one pending alert per user (a new rest
 * replaces the last): right for the single app instance this runs on. A
 * restart or deploy drops the pending ones (that rest just ends without a
 * notification), and a second instance would need a shared store.
 *
 * Every request carries the client's sequence number (increasing per device),
 * so requests that arrive out of order can't revive a rest already taken back.
 */

/** A rest this long or longer is no rest: refused. */
export const REST_ALERT_MAX_DELAY_MS = 60 * 60 * 1000;
/** Less than this left: the page's own cue (or nothing) is all there is time for. */
export const REST_ALERT_MIN_DELAY_MS = 1000;
/** Users with a pending alert or a recent one, kept at most. */
const MAX_ENTRIES = 5000;
/** How long a fired or cancelled alert's sequence is kept to refuse late requests. */
const KEEP_DONE_MS = 2 * 60 * 60 * 1000;
/** The text that varies ("Série 2 · Supino reto"); clipped again by pushMessage. */
export const REST_ALERT_NEXT_MAX = 120;

interface Entry {
  seq: number;
  handle: ReturnType<typeof setTimeout> | null;
  /** When it was last scheduled, fired or cancelled. */
  at: number;
}

export type ScheduleOutcome = "scheduled" | "stale" | "full";

export class RestAlertScheduler {
  private readonly entries = new Map<string, Entry>();

  /** Replaces the user's pending alert with one that fires `fire` in `delayMs`. */
  schedule(userId: string, seq: number, delayMs: number, fire: () => unknown): ScheduleOutcome {
    const now = Date.now();
    const prev = this.entries.get(userId);
    if (prev && seq <= prev.seq) return "stale";
    if (!prev && !this.roomForOneMore(now)) return "full";
    if (prev?.handle) clearTimeout(prev.handle);
    const entry: Entry = { seq, handle: null, at: now };
    const wait = Math.min(REST_ALERT_MAX_DELAY_MS, Math.max(0, Math.round(delayMs)));
    entry.handle = setTimeout(() => {
      entry.handle = null;
      entry.at = Date.now();
      void Promise.resolve()
        .then(fire)
        .catch((err: unknown) => console.warn("[rest-alert] send failed", err instanceof Error ? err.message : err));
    }, wait);
    // Never what keeps the process alive (a shutdown, a test run).
    (entry.handle as { unref?: () => void }).unref?.();
    this.entries.set(userId, entry);
    return "scheduled";
  }

  /** Takes back the user's pending alert; true when there was one to take back. */
  cancel(userId: string, seq: number): boolean {
    const now = Date.now();
    const prev = this.entries.get(userId);
    // A take-back older than the alert now pending was meant for an earlier rest.
    if (prev && seq < prev.seq) return false;
    const had = prev?.handle != null;
    if (prev?.handle) clearTimeout(prev.handle);
    // Kept (as done) so a schedule sent before this but arriving after it is refused.
    if (prev || this.roomForOneMore(now)) this.entries.set(userId, { seq, handle: null, at: now });
    return had;
  }

  pending(userId: string): boolean {
    return this.entries.get(userId)?.handle != null;
  }

  private roomForOneMore(now: number): boolean {
    if (this.entries.size < MAX_ENTRIES) return true;
    for (const [userId, entry] of this.entries) {
      if (!entry.handle && now - entry.at > KEEP_DONE_MS) this.entries.delete(userId);
    }
    return this.entries.size < MAX_ENTRIES;
  }
}

const holder = globalThis as typeof globalThis & { __fgRestAlerts?: RestAlertScheduler };
/** The process's scheduler: on globalThis, so every route bundle (and a dev reload) shares one. */
export const restAlerts: RestAlertScheduler = (holder.__fgRestAlerts ??= new RestAlertScheduler());

/** What comes next, as the client named it: one plain line, never markup. */
export function cleanNext(next: string | null | undefined): string | null {
  if (typeof next !== "string") return null;
  const line = next.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  if (!line) return null;
  return line.length <= REST_ALERT_NEXT_MAX ? line : `${line.slice(0, REST_ALERT_NEXT_MAX - 1).trimEnd()}…`;
}

/**
 * "Descanso acabou" · "Série 2 · Supino reto": the notification, opening the
 * workout on a tap. No loads: it shows on a lock screen. One tag, so a newer
 * rest's notification replaces an older one still in the tray (the service
 * worker plays it quietly when the workout is on screen and focused).
 */
export function restAlertPayload(input: { sessionId: string; kind: "rest" | "transition"; next: string | null }): PushPayload {
  return {
    title: input.kind === "transition" ? "Hora de trocar de exercício" : "Descanso acabou",
    body: cleanNext(input.next) ?? "Hora da próxima série.",
    url: `/app/workout/${encodeURIComponent(input.sessionId)}`,
    tag: REST_ALERT_TAG,
  };
}

/** The notification's tag; public/sw.js knows it too. */
export const REST_ALERT_TAG = "rest-end";
