import "server-only";

/**
 * Publishing a finished workout to the feed (W-048 auto-publish, W-008 share
 * links) — owned by the sharing cluster (C3).
 *
 * Phase 0 stub with the final signature: finish-hooks.ts calls it after every
 * finished workout. It publishes nothing yet, so finishing behaves as before.
 */

/**
 * The sharing defaults onboarding writes into a new profile. The column's
 * default is already FOLLOWERS (decision 10 as decided, D-A: new profiles
 * publish to their followers, loads hidden); until publishOnFinish ships,
 * new profiles still start PRIVATE, so the summary doesn't preselect an
 * audience nothing publishes to. C3 makes this FOLLOWERS with W-048.
 */
export const NEW_PROFILE_SHARING = { defaultWorkoutVisibility: "PRIVATE" } as const;

/**
 * Creates the WORKOUT activity for a just-finished session with the
 * session's own visibility and loads flag (set from the profile's defaults
 * when it was opened), dated `finishedAt`. Nothing when the session is
 * PRIVATE or already has an activity; never mints a share token. Returns the
 * activity it created, or null.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Phase 0 stub (C3 implements W-048 §3)
export async function publishOnFinish(userId: string, sessionId: string, finishedAt: Date): Promise<{ activityId: string } | null> {
  return null;
}
