import { wallClock } from "@/lib/training/week";

/** How long the app may sit in the background before a resume re-fetches the page. */
export const RESUME_REFRESH_AFTER_MS = 5 * 60 * 1000;

/** The live workout keeps its own state (drafts, timers) — a refresh there would fight it. */
export function isLiveWorkoutPath(pathname: string): boolean {
  return pathname.startsWith("/app/workout/");
}

/**
 * The workout screen itself, in focus mode: no bottom nav, so a mistap can't
 * drop the user out mid-session. The post-workout summary keeps the nav.
 */
export function isWorkoutFocusPath(pathname: string): boolean {
  return isLiveWorkoutPath(pathname) && !pathname.endsWith("/summary");
}

function spDay(ms: number) {
  const w = wallClock(new Date(ms));
  return `${w.year}-${w.month}-${w.day}`;
}

/**
 * Whether a page rendered before `hiddenAt` is stale when the app comes back
 * at `now`: it slept longer than the threshold, or the São Paulo calendar day
 * turned over meanwhile (greeting, "this week", days done all key off it).
 */
export function shouldRefreshOnResume(hiddenAt: number, now: number): boolean {
  return now - hiddenAt > RESUME_REFRESH_AFTER_MS || spDay(hiddenAt) !== spDay(now);
}

/**
 * True when a failure looks like the network, not the app: the browser says
 * it's offline, or a fetch rejected with the TypeError browsers use for that
 * ("Failed to fetch" / "Load failed" / "NetworkError when attempting…").
 */
export function isNetworkError(error: unknown, online: boolean): boolean {
  if (!online) return true;
  if (!(error instanceof Error)) return false;
  return error.name === "TypeError" && /fetch|network|load failed/i.test(error.message);
}
