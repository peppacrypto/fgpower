"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { readWorkoutPref, writeWorkoutPref } from "@/components/workout/local-workout";
import { cn } from "@/lib/utils/cn";
import {
  FIGURE_HEIGHT,
  WORKOUT_FIGURE_COOKIE,
  WORKOUT_FIGURE_COOKIE_PATH,
  WORKOUT_FIGURE_PREF,
  boneFigure,
  type WorkoutFigureSize,
} from "./workout-figure";

const noSubscribe = () => () => {};
const readMemory = () => readWorkoutPref(WORKOUT_FIGURE_PREF) ?? "";
/** The server's render (and the hydration that must match it) uses the cookie's answer, `server`. */
const ON_SERVER = "\u0000";
const onServer = () => ON_SERVER;

/**
 * The workout skeleton's room for the exercise's figure (workout-figure), so
 * the set table lands where it will be. A client navigation reads this
 * device's pref (for the workout in the address, when it is already there);
 * the server (a reload) draws it from the cookie, which `server` carries.
 */
export function FigureBone({ server }: { server: WorkoutFigureSize | null }) {
  const pathname = usePathname();
  const sessionId = /^\/app\/workout\/([^/]+)\/?$/.exec(pathname ?? "")?.[1] ?? null;
  const raw = useSyncExternalStore(noSubscribe, readMemory, onServer);
  const size = raw === ON_SERVER ? server : boneFigure(raw || null, sessionId);
  if (!size) return null;
  return <div aria-hidden data-figure-bone className={cn("sk mt-2 w-full rounded-[var(--radius-md)]", FIGURE_HEIGHT[size])} />;
}

/** Records the figure a reload of this workout would land on, in the pref and the cookie. */
export function rememberWorkoutFigure(value: string) {
  if (readWorkoutPref(WORKOUT_FIGURE_PREF) !== value) writeWorkoutPref(WORKOUT_FIGURE_PREF, value);
  try {
    const current = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${WORKOUT_FIGURE_COOKIE}=`))
      ?.slice(WORKOUT_FIGURE_COOKIE.length + 1);
    if (current !== value) {
      document.cookie = `${WORKOUT_FIGURE_COOKIE}=${value}; path=${WORKOUT_FIGURE_COOKIE_PATH}; samesite=lax; max-age=31536000`;
    }
  } catch {
    /* cookies blocked — a reload's skeleton keeps the usual room */
  }
}
