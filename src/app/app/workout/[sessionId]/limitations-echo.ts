/**
 * How tall the "Você informou" note last stood on this device's workout
 * screen, margin included — so the loading skeleton keeps that much room and
 * the set table lands where it will be (limitations-bone.tsx). Absent when
 * the screen showed none (closed, or past the first workouts).
 *
 * Kept as a workout pref (localStorage, read by the skeleton a client
 * navigation draws) and in its own small cookie, read by loading.tsx: the
 * skeleton a reload streams (a restored or discarded tab) is drawn by the
 * server. Shared by the server skeleton and the client, so no "use client".
 */
export const LIMITATIONS_ECHO_PX = "limitations-echo-px";
export const LIMITATIONS_ECHO_COOKIE = "fg-wl";
export const LIMITATIONS_ECHO_COOKIE_PATH = "/app/workout";

/** A stored height as the bone's: a plausible px, else 0 (no room kept). */
export function echoPx(raw: string | null | undefined): number {
  const px = Math.round(Number(raw));
  return px > 12 && px < 400 ? px : 0;
}
