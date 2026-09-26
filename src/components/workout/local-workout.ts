/**
 * What the workout screen leaves on this device for a session: its draft
 * mirror (rows typed or ✓'d that the server may not have yet) and its rest
 * timer. The storage keys live here and are shared by the workout screen
 * (workout-execution-client.tsx, rest-timer.tsx), Today and public/offline.html
 * (which can't import them — keep its prefix in step). Browser-only; every
 * access tolerates blocked storage.
 */

export const DRAFTS_KEY_PREFIX = "fg:workout-drafts:";
export const REST_KEY_PREFIX = "fg:rest:";
export const draftsKey = (sessionId: string) => `${DRAFTS_KEY_PREFIX}${sessionId}`;
export const restKey = (sessionId: string) => `${REST_KEY_PREFIX}${sessionId}`;

/**
 * How many rows of the session this device holds that were never confirmed by
 * the server (typed or ✓'d offline, then the app was closed). Only the workout
 * screen can send them — it merges them with the saved values — so a session
 * with any must be closed from there, not from Today.
 */
export function countUnsyncedRows(sessionId: string): number {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(draftsKey(sessionId)) ?? "null") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return 0;
    const p = parsed as { v?: unknown; rows?: unknown };
    if (p.v === 2) {
      if (!p.rows || typeof p.rows !== "object") return 0;
      return Object.values(p.rows as Record<string, unknown>).filter(
        (row) => !!row && typeof row === "object" && (row as { dirty?: unknown }).dirty === true,
      ).length;
    }
    // First version: every stored row was an unconfirmed typed value.
    return Object.keys(parsed).length;
  } catch {
    return 0;
  }
}

/** The session is closed: drop its mirror and rest timer from this device. */
export function forgetLocalWorkout(sessionId: string) {
  try {
    window.localStorage.removeItem(draftsKey(sessionId));
    window.localStorage.removeItem(restKey(sessionId));
  } catch {
    /* storage unavailable — nothing was kept */
  }
}
