"use client";

/**
 * The unread-notifications count, fresh on every screen of the app shell
 * (the /app layout isn't re-rendered on client navigations, so a count
 * rendered there alone would go stale). Owned by the social inbox cluster
 * (C1, W-042): re-reads GET /api/notifications/unread on navigation and on
 * return to the tab, and on the window event "fg:unread".
 *
 * Phase 0 stub with the final signatures: no count is shown yet.
 */

/** Wraps the app shell; `initial` is the server's count at render. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Phase 0 stub (C1 implements W-042)
export function UnreadProvider({ initial, children }: { initial: number; children: React.ReactNode }) {
  return <>{children}</>;
}

/** The current unread count (0 outside the provider). */
export function useUnread(): number {
  return 0;
}

/** The square count badge ("9+" above 9); renders nothing at 0. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Phase 0 stub (C1 implements W-042)
export function UnreadPip({ count, className }: { count: number; className?: string }) {
  return null;
}

/**
 * Tells the provider the count changed: with a number (e.g. what
 * markNotificationsSeen returned) it is applied as is; without one the
 * provider re-reads it.
 */
export function announceUnread(count?: number) {
  window.dispatchEvent(new CustomEvent("fg:unread", { detail: count === undefined ? {} : { unread: count } }));
}
