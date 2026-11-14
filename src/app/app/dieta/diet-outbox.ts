import { startTransition } from "react";
import { OFFLINE_ERROR, runAction } from "@/components/social/run-action";
import { saveDietMarks, type DietMarkInput } from "@/lib/actions/diet";
import { isSessionExpiredError } from "@/lib/auth/session-expired";
import { MAX_PIECES } from "@/lib/diet/plan";

/**
 * Dieta's outbox: every tap on an item is a mark (the state wanted for that
 * item and day) that shows at once and goes to the server from here, one
 * batch at a time, until the server has it — on a timer that backs off, when
 * the signal comes back, when the app comes back to the screen, and with the
 * next tap. Marks the server hasn't confirmed are mirrored in localStorage, so
 * a dead tab or a closed app doesn't lose them: the next visit sends them.
 *
 * A confirmed mark keeps showing until the page's own data is newer than the
 * confirmation (`settle`, the page's read time vs the save's), so the screen
 * never flips back to a staler server copy in between. One outbox per account
 * and tab, kept across day changes; browser only.
 */

export type DietFailure =
  /** No signal: sent when it comes back. */
  | { kind: "offline" }
  /** The save didn't go through: tried again on a timer. */
  | { kind: "retry" }
  /** Signed out: held here until the user signs in again. */
  | { kind: "session"; message: string }
  /** Not kept: the plan changed (or is gone) since the page loaded. */
  | { kind: "rejected"; message: string };

export interface OutboxEntry {
  mark: DietMarkInput;
  /** Bumped on every change: a confirmation only settles the revision it was sent with. */
  rev: number;
  /** Server time the mark was confirmed; null while the server doesn't have it. */
  confirmedAtMs: number | null;
}

export interface DietOutboxState {
  /** The marks this device holds over the page's data, by `${date}|${itemId}`. */
  entries: ReadonlyMap<string, OutboxEntry>;
  /** Marks the server doesn't have yet (any day). */
  pending: number;
  sending: boolean;
  failure: DietFailure | null;
  /** The last confirmed save (SaveStatus's "Salvo ✓"). */
  savedAt: string | null;
}

export const EMPTY_OUTBOX_STATE: DietOutboxState = Object.freeze({
  entries: new Map(),
  pending: 0,
  sending: false,
  failure: null,
  savedAt: null,
});

export const markKey = (date: string, itemId: string) => `${date}|${itemId}`;

/** Whether an entry still speaks over the page's data, read at `loadedAtMs` (server time). */
export function entryApplies(entry: OutboxEntry, loadedAtMs: number): boolean {
  return entry.confirmedAtMs === null || entry.confirmedAtMs > loadedAtMs;
}

const STORAGE_PREFIX = "fg:diet-marks:";
const RETRY_MIN_MS = 4000;
const RETRY_MAX_MS = 30_000;
const BATCH = 100;
const PLAN_CHANGED = "O plano mudou desde que a página abriu: confira as marcações.";

/** Pieces by kind id, as a mark sends them: a few short ids, each a whole number up to MAX_PIECES. */
function isCounts(v: unknown): boolean {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const entries = Object.entries(v);
  return (
    entries.length <= 8 &&
    entries.every(([id, n]) => id.length <= 48 && typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= MAX_PIECES)
  );
}

function isMark(v: unknown): v is DietMarkInput {
  if (!v || typeof v !== "object") return false;
  const m = v as Record<string, unknown>;
  return (
    typeof m.date === "string" &&
    m.date.length <= 10 &&
    typeof m.itemId === "string" &&
    m.itemId.length <= 48 &&
    typeof m.eaten === "boolean" &&
    (m.choiceId === null || (typeof m.choiceId === "string" && m.choiceId.length <= 48)) &&
    // Absent in marks stored before items had pieces: as planned.
    (m.counts == null || isCounts(m.counts))
  );
}

class DietOutbox {
  private entries = new Map<string, OutboxEntry>();
  private listeners = new Set<() => void>();
  private state: DietOutboxState = EMPTY_OUTBOX_STATE;
  private rev = 0;
  private inFlight = false;
  private again = false;
  private failure: DietFailure | null = null;
  private savedAt: string | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private retryDelay = RETRY_MIN_MS;
  private refreshers = new Set<() => void>();

  constructor(private readonly storageKey: string) {
    for (const mark of this.readStored()) this.entries.set(markKey(mark.date, mark.itemId), { mark, rev: ++this.rev, confirmedAtMs: null });
    this.state = this.build();
    window.addEventListener("online", () => {
      this.retryDelay = RETRY_MIN_MS;
      this.flush();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") this.flush();
    });
    window.addEventListener("pageshow", () => this.flush());
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = () => this.state;

  /** The screen's router.refresh, for when the server says its data is stale (a plan changed). */
  onStale(refresh: () => void) {
    this.refreshers.add(refresh);
    return () => {
      this.refreshers.delete(refresh);
    };
  }

  /** Sets the state wanted for an item on a day: shown at once, sent from here. */
  mark(mark: DietMarkInput) {
    this.entries.set(markKey(mark.date, mark.itemId), { mark, rev: ++this.rev, confirmedAtMs: null });
    if (this.failure?.kind === "rejected") this.failure = null;
    this.changed();
    this.flush();
  }

  /** Forgets the confirmations a day's data (read at `loadedAtMs`) already has. */
  settle(date: string, loadedAtMs: number) {
    let dropped = false;
    for (const [key, entry] of this.entries) {
      if (entry.mark.date === date && entry.confirmedAtMs !== null && entry.confirmedAtMs <= loadedAtMs) {
        this.entries.delete(key);
        dropped = true;
      }
    }
    if (dropped) this.changed(false);
  }

  /** Sends what the server doesn't have yet (one batch in flight; what comes meanwhile goes next). */
  flush() {
    if (this.inFlight) {
      this.again = true;
      return;
    }
    const batch = [...this.entries].filter(([, e]) => e.confirmedAtMs === null).slice(0, BATCH);
    if (batch.length === 0) return;
    clearTimeout(this.retryTimer);
    this.inFlight = true;
    this.changed(false);
    const sent = batch.map(([key, e]) => ({ key, rev: e.rev }));
    startTransition(async () => {
      const result = await runAction(() => saveDietMarks({ marks: batch.map(([, e]) => e.mark) }));
      this.inFlight = false;
      let stale = false;
      if (result.ok) {
        const at = Date.parse(result.savedAt);
        for (const { key, rev } of sent) {
          const e = this.entries.get(key);
          if (e && e.rev === rev) this.entries.set(key, { ...e, confirmedAtMs: at });
        }
        this.retryDelay = RETRY_MIN_MS;
        this.savedAt = result.savedAt;
        this.failure = result.skipped > 0 ? { kind: "rejected", message: PLAN_CHANGED } : null;
        stale = result.skipped > 0;
      } else if (isSessionExpiredError(result.error)) {
        // Held: sent again when the app comes back to the screen (signed in again) or with the next tap.
        this.failure = { kind: "session", message: result.error };
      } else if ("permanent" in result && result.permanent) {
        for (const { key, rev } of sent) if (this.entries.get(key)?.rev === rev) this.entries.delete(key);
        this.failure = { kind: "rejected", message: result.error };
        stale = true;
      } else {
        const offline = result.error === OFFLINE_ERROR || (typeof navigator !== "undefined" && navigator.onLine === false);
        this.failure = { kind: offline ? "offline" : "retry" };
        this.scheduleRetry();
      }
      this.changed();
      if (stale) for (const refresh of this.refreshers) refresh();
      const more = [...this.entries.values()].some((e) => e.confirmedAtMs === null);
      // Right away when a tap came in meanwhile or the connection works; else the retry timer decides.
      if ((this.again || (result.ok && more)) && this.failure?.kind !== "session") {
        this.again = false;
        this.flush();
      } else {
        this.again = false;
      }
    });
  }

  private scheduleRetry() {
    clearTimeout(this.retryTimer);
    const delay = this.retryDelay;
    this.retryDelay = Math.min(RETRY_MAX_MS, delay * 2);
    this.retryTimer = setTimeout(() => this.flush(), delay);
  }

  private build(): DietOutboxState {
    let pending = 0;
    for (const e of this.entries.values()) if (e.confirmedAtMs === null) pending += 1;
    return { entries: new Map(this.entries), pending, sending: this.inFlight, failure: this.failure, savedAt: this.savedAt };
  }

  /** A new state for the screens (and, with `persist`, the local mirror of what's unconfirmed). */
  private changed(persist = true) {
    this.state = this.build();
    if (persist) this.writeStored();
    for (const listener of this.listeners) listener();
  }

  private readStored(): DietMarkInput[] {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(this.storageKey) ?? "null") as unknown;
      if (!parsed || typeof parsed !== "object") return [];
      const p = parsed as { v?: unknown; marks?: unknown };
      if (p.v !== 1 || !Array.isArray(p.marks)) return [];
      return p.marks.filter(isMark).slice(0, 1000);
    } catch {
      return [];
    }
  }

  private writeStored() {
    try {
      const marks = [...this.entries.values()].filter((e) => e.confirmedAtMs === null).map((e) => e.mark);
      if (marks.length === 0) window.localStorage.removeItem(this.storageKey);
      else window.localStorage.setItem(this.storageKey, JSON.stringify({ v: 1, marks }));
    } catch {
      /* storage unavailable (private mode): the marks still live in memory */
    }
  }
}

const outboxes = new Map<string, DietOutbox>();

/** The account's outbox in this tab (browser only), created with what an earlier visit left unsent. */
export function dietOutbox(userId: string): DietOutbox {
  let outbox = outboxes.get(userId);
  if (!outbox) {
    outbox = new DietOutbox(`${STORAGE_PREFIX}${userId}`);
    outboxes.set(userId, outbox);
  }
  return outbox;
}

export type { DietOutbox };
