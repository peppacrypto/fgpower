/**
 * Where social things live. Every social link goes through these, so moving
 * a destination (a signed-in profile inside the app shell, say) is one edit.
 * Pure and client-safe.
 */
export { sharePath, storyPath } from "./share-token";

/** A person's profile (public for anyone, in the app shell for signed-in viewers). */
export function profileHref(username: string): string {
  return `/u/${encodeURIComponent(username)}`;
}

/** An activity (a shared workout, a stamp) inside the app. */
export function activityHref(activityId: string): string {
  return `/app/activity/${encodeURIComponent(activityId)}`;
}

/** A finished workout's summary (its owner's records, week and next step). */
export function workoutSummaryHref(sessionId: string): string {
  return `/app/workout/${encodeURIComponent(sessionId)}/summary`;
}
