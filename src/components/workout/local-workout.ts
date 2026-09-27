/**
 * What the workout screen leaves on this device for a session: its draft
 * mirror (rows typed or ✓'d that the server may not have yet), its rest
 * timer, and a few per-device preferences. The storage keys live here and are shared by the workout screen
 * (workout-execution-client.tsx, rest-timer.tsx), Today and public/offline.html
 * (which can't import them — keep its prefix in step). Storage access is
 * browser-only and tolerates blocked storage; devicePrefsFrom and
 * parseWorkoutPrefsCookie also run on the server (the workout page).
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

/**
 * Small per-device conveniences of the workout screen (how many grey
 * suggestions were used, whether warm-up rows stay open, a note closed for a
 * session). Never data: losing them only brings a hint back.
 *
 * Kept in localStorage and mirrored to a small cookie the workout page reads,
 * so the server renders the screen as this device left it — a hint that is
 * already folded must not show and then vanish under the finger right after
 * the page loads.
 */
const PREF_KEY_PREFIX = "fg:workout-pref:";
export const WORKOUT_PREFS_COOKIE = "fg-wp";
const PREFS_COOKIE_PATH = "/app/workout";

export const WORKOUT_PREF = {
  /** ✓ taps that used the grey suggestions (counted up to SUGGESTIONS_LEARNED_AFTER). */
  suggestionsUsed: "suggestions-used",
  /** "1": the user logs warm-ups, show their rows open. */
  warmupsOpen: "warmups-open",
  /** The session whose "Você informou" note was closed. */
  limitationsClosed: "limitations-closed",
} as const;
/** After this many ✓'s on the grey suggestions, their explanation folds into an (i). */
export const SUGGESTIONS_LEARNED_AFTER = 3;

export interface WorkoutDevicePrefs {
  suggestionsLearned: boolean;
  warmupsOpen: boolean;
  limitationsClosed: boolean;
}

/** The screen's per-device state for a session, from localStorage (browser) or the cookie (server). */
export function devicePrefsFrom(read: (name: string) => string | null | undefined, sessionId: string): WorkoutDevicePrefs {
  return {
    suggestionsLearned: (Number(read(WORKOUT_PREF.suggestionsUsed)) || 0) >= SUGGESTIONS_LEARNED_AFTER,
    warmupsOpen: read(WORKOUT_PREF.warmupsOpen) === "1",
    limitationsClosed: read(WORKOUT_PREF.limitationsClosed) === sessionId,
  };
}

/** The cookie mirror's value as a map (server and browser). Garbage reads as empty. */
export function parseWorkoutPrefsCookie(raw: string | undefined | null): Record<string, string> {
  if (!raw) return {};
  try {
    let text = raw;
    try {
      text = decodeURIComponent(raw);
    } catch {
      /* already decoded */
    }
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) if (typeof v === "string") out[k] = v.slice(0, 64);
    return out;
  } catch {
    return {};
  }
}

export function readWorkoutPref(name: string): string | null {
  try {
    return window.localStorage.getItem(`${PREF_KEY_PREFIX}${name}`);
  } catch {
    return null;
  }
}

export function writeWorkoutPref(name: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(`${PREF_KEY_PREFIX}${name}`);
    else window.localStorage.setItem(`${PREF_KEY_PREFIX}${name}`, value);
  } catch {
    /* storage unavailable — the hint just shows again */
  }
  mirrorWorkoutPrefs();
}

/** Copies the prefs this device holds into the cookie the workout page reads. */
export function mirrorWorkoutPrefs() {
  try {
    const prefs: Record<string, string> = {};
    for (const name of Object.values(WORKOUT_PREF)) {
      const v = readWorkoutPref(name);
      if (v !== null) prefs[name] = v;
    }
    const current = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${WORKOUT_PREFS_COOKIE}=`))
      ?.slice(WORKOUT_PREFS_COOKIE.length + 1);
    const value = encodeURIComponent(JSON.stringify(prefs));
    if (Object.keys(prefs).length === 0) {
      if (current !== undefined) document.cookie = `${WORKOUT_PREFS_COOKIE}=; path=${PREFS_COOKIE_PATH}; max-age=0; samesite=lax`;
    } else if (current !== value) {
      document.cookie = `${WORKOUT_PREFS_COOKIE}=${value}; path=${PREFS_COOKIE_PATH}; max-age=31536000; samesite=lax`;
    }
  } catch {
    /* cookies blocked — the screen settles after load instead */
  }
}
