"use client";

import { useSyncExternalStore } from "react";
import { readWorkoutPref, writeWorkoutPref } from "@/components/workout/local-workout";
import {
  LIMITATIONS_ECHO_COOKIE,
  LIMITATIONS_ECHO_COOKIE_PATH,
  LIMITATIONS_ECHO_PX,
  echoPx,
} from "./limitations-echo";

const noSubscribe = () => () => {};
const readHeight = () => echoPx(readWorkoutPref(LIMITATIONS_ECHO_PX));

/**
 * The workout skeleton's room for the "Você informou" note (limitations-echo).
 * The skeleton mostly stands in when a workout already open on this device is
 * continued or reloaded, so the height the screen last measured is where the
 * set table will land; without one it takes no room, as for everyone without
 * limitations. A client navigation reads this device's pref; the server
 * (a reload) draws it from the cookie, which `serverPx` carries — the same
 * value, so hydration keeps it.
 */
export function LimitationsBone({ serverPx = 0 }: { serverPx?: number }) {
  const px = useSyncExternalStore(noSubscribe, readHeight, () => serverPx);
  if (!px) return null;
  return <div aria-hidden data-limitations-bone className="sk mb-3 rounded-[2px]" style={{ height: px - 12 }} />;
}

/**
 * Records the note's height (px as a string, or null when the screen shows
 * none) in the pref and in the cookie the server skeleton reads; the cookie
 * is also brought in step when only it is behind (set before it existed).
 */
export function rememberLimitationsEcho(value: string | null) {
  if (readWorkoutPref(LIMITATIONS_ECHO_PX) !== value) writeWorkoutPref(LIMITATIONS_ECHO_PX, value);
  try {
    const current = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${LIMITATIONS_ECHO_COOKIE}=`))
      ?.slice(LIMITATIONS_ECHO_COOKIE.length + 1);
    const base = `path=${LIMITATIONS_ECHO_COOKIE_PATH}; samesite=lax`;
    if (value === null) {
      if (current !== undefined) document.cookie = `${LIMITATIONS_ECHO_COOKIE}=; ${base}; max-age=0`;
    } else if (current !== value) {
      document.cookie = `${LIMITATIONS_ECHO_COOKIE}=${value}; ${base}; max-age=31536000`;
    }
  } catch {
    /* cookies blocked — a reload's skeleton just keeps no room */
  }
}
