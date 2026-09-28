/**
 * What the workout screen keeps for this tab's visit (sessionStorage: gone
 * when the installed app is closed or killed, kept across in-app navigation):
 *
 * - that a workout screen was open in this visit — Today sends a fresh visit
 *   straight back to a workout in progress (W-097: iOS kills the app during
 *   a rest and it reopens on Today), but only once: after that "Hoje" is Today;
 * - which exercise was on screen per workout (W-025), so coming back from
 *   "Ver página completa" (a back step, a reload) — or from Today's
 *   "Continuar" — lands on it.
 *
 * Browser-only; every access tolerates blocked storage.
 */

const VISITED_KEY = "fg:workout-visited";
const SHOWN_KEY_PREFIX = "fg:workout-ex:";

/** A workout screen was opened in this visit: Today stops sending the user back to it. */
export function markWorkoutVisited() {
  try {
    window.sessionStorage.setItem(VISITED_KEY, "1");
  } catch {
    /* storage unavailable — Today may send the user back once more */
  }
}

/** Whether this visit already opened a workout screen (or was sent to one). */
export function workoutVisited(): boolean {
  try {
    return window.sessionStorage.getItem(VISITED_KEY) === "1";
  } catch {
    // Without storage, never redirect: a loop between Today and the workout is worse than a tap.
    return true;
  }
}

/**
 * Remembers the exercise on screen for this visit. Not in the URL: the router
 * rewrites the history entry with its own copy of the address, so a
 * replaceState of ?ex= can be undone behind our back. Links that leave the
 * workout on purpose ("Ver página completa") carry ?ex= in their way back.
 */
export function rememberShownExercise(sessionId: string, exerciseLogId: string) {
  try {
    window.sessionStorage.setItem(`${SHOWN_KEY_PREFIX}${sessionId}`, exerciseLogId);
  } catch {
    /* storage unavailable — the screen opens on the first exercise still to do */
  }
}

/** The exercise last on screen for this workout in this visit, if any. */
export function readShownExercise(sessionId: string): string | null {
  try {
    return window.sessionStorage.getItem(`${SHOWN_KEY_PREFIX}${sessionId}`);
  } catch {
    return null;
  }
}
