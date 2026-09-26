"use client";

import { useEffect } from "react";

/**
 * Keeps the screen on while the workout is on screen, so the phone doesn't
 * auto-lock mid-rest. The browser drops the lock whenever the page is hidden;
 * it is taken again when the page comes back. Refusals (battery saver, an
 * unsupported browser) are fine — the screen may just sleep as usual.
 */
export function useWakeLock() {
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let requesting = false;
    let unmounted = false;

    const acquire = async () => {
      if (unmounted || lock || requesting || document.visibilityState !== "visible") return;
      requesting = true;
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        if (unmounted) {
          void sentinel.release().catch(() => {});
          return;
        }
        lock = sentinel;
        sentinel.addEventListener("release", () => {
          if (lock === sentinel) lock = null;
        });
      } catch {
        /* refused */
      } finally {
        requesting = false;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      unmounted = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void lock?.release().catch(() => {});
      lock = null;
    };
  }, []);
}
